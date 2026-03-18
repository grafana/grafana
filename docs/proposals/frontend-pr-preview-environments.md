# Frontend PR Preview Environments

## Problem

Testing frontend changes in a production-like environment currently requires building and deploying the entire Grafana Docker image. This is slow and heavyweight — a full image build just to verify a CSS fix or a component change.

We want to support lightweight, temporary test environments for frontend PRs where:

1. Only the frontend assets are built (`yarn build`)
2. Assets are uploaded to a bucket/CDN at a known path
3. A user can opt-in to loading those assets instead of the default ones

This lets us validate frontend changes against real backend services without touching the Docker image or deployment pipeline.

## How the frontend service serves assets today

The frontend service renders `index.html` with asset URLs pointing to a CDN. The flow is:

1. Read `assets-manifest.json` from the local filesystem (`<StaticRootPath>/build/`)
2. Construct a CDN URL from config (e.g. `https://grafana-assets.grafana.net/grafana/cloud/10.3.0/`)
3. Prefix all manifest asset paths with the CDN URL
4. Render the `index.html` template with these URLs
5. The browser loads JS/CSS directly from the CDN

The frontend service does **not** serve static files itself — it returns 404 for `/public/*` requests. It only renders the HTML that references the assets.

## Approach: cookie-based asset override with confirmation page

A user visits a special URL with an **asset ID** to opt-in to preview assets. The asset ID is combined with a configured base URL to form the full override URL. The flow is:

1. User visits `/-/set-preview-assets?assets=<asset_id>` (e.g. `?assets=pr-12345`)
2. A confirmation page is shown, displaying the resolved URL and warning about the override
3. CSRF protection prevents a malicious actor from tricking a user into visiting this URL directly
4. On confirmation, an HTTP-only cookie (`grafana_assets_override`) is set with the asset ID (24-hour expiry)
5. On redirect to the homepage, and on all subsequent page loads, the cookie is read, the full URL is resolved from the configured base URL + asset ID, and the override assets are served

When the cookie is present and valid, the frontend service:
- Resolves the full URL: `<base_url><asset_id>/`
- Fetches the assets manifest from `<full_url>public/build/assets-manifest.json` via HTTPS
- Uses the full URL as the CDN base for all asset references
- Sets `AssetsOverridden: true` in the template data (for future use by the frontend)

The `/-/set-preview-assets` routes are only registered when the feature is enabled, so in production the endpoint does not exist.

### Example

Given the config:
```ini
[server]
assets_base_override_enabled = true
assets_base_override_base_url = https://storage.googleapis.com/grafana-preview/
```

1. PR CI builds assets and uploads to `https://storage.googleapis.com/grafana-preview/pr-12345/`
2. User visits: `/-/set-preview-assets?assets=pr-12345`
3. Confirmation page shows the resolved URL `https://storage.googleapis.com/grafana-preview/pr-12345/` and asks user to confirm
4. User clicks "Confirm" — cookie `grafana_assets_override=pr-12345` is set, user is redirected to `/`
5. All subsequent page loads resolve the cookie to the full URL and load preview assets
6. Cookie expires after 24 hours, or user deletes it manually

## What changed

**Export shared utility** (`pkg/api/webassets/webassets.go`)
- `readWebAssetsFromCDN` → `ReadWebAssetsFromCDN` — this function already existed but was unexported. It fetches a manifest from a remote URL and uses that URL as the CDN prefix.
- `HTTPClient` exported for test overrides
- Response body limited to 10MB

**Startup-time config** (`pkg/setting/setting.go`)
- Added `AssetsBaseOverrideEnabled` (bool, default `false`) and `AssetsBaseOverrideBaseURL` (string) fields
- Read from `[server]` section during startup — not overridable via Settings Service

**Override asset loading** (`pkg/services/frontend/webassets/webassets.go`)
- `GetWebAssets` now accepts an `assetsBaseOverrideURL` parameter (the fully resolved URL)
- Validates: feature enabled, URL is HTTPS, URL starts with configured base URL — falls back to default assets if any check fails
- In-memory cache with 30-second TTL avoids fetching on every request

**Preview assets confirmation page** (`pkg/services/frontend/set_preview_assets.go`)
- `GET /-/set-preview-assets?assets=<id>` — validates asset ID (alphanumeric, hyphens, underscores, dots, slashes; no path traversal), generates CSRF token, renders confirmation page
- `POST /-/set-preview-assets` — validates CSRF token, validates asset ID again, sets the `grafana_assets_override` cookie with just the ID (24h, HTTP-only), redirects to `/`
- Confirmation page HTML is embedded via `//go:embed` (`set_preview_assets_confirm.html`)

**Cookie-based override in index handler** (`pkg/services/frontend/index.go`)
- `HandleRequest` reads the `grafana_assets_override` cookie, resolves the full URL from `<base_url><id>/`, and passes it to `GetWebAssets`
- `AssetsOverridden` field added to `IndexViewData`

**Route registration** (`pkg/services/frontend/frontend_service.go`)
- GET and POST handlers for `/-/set-preview-assets` are only registered when `AssetsBaseOverrideEnabled` is `true`

**Tests**
- Integration test: sets cookie with asset ID, verifies rendered HTML uses override asset URLs
- Handler tests: CSRF flow, redirect on success, validation rejections (disabled, no base URL, invalid ID characters, path traversal, missing token, mismatched token)
- Webassets tests: URL validation (disabled, not HTTPS, base URL mismatch), remote manifest fetch with TLS

## How it fits together end-to-end

```
User visits /-/set-preview-assets?assets=pr-42
         │
         ▼
┌─────────────────────────────┐
│  GET handler                │
│  - validates asset ID       │
│  - resolves full URL from   │
│    base_url + ID            │
│  - generates CSRF token     │
│  - sets CSRF cookie         │
│  - renders confirmation     │
│    page showing full URL    │
└────────────┬────────────────┘
             │ user clicks "Confirm"
             ▼
┌─────────────────────────────┐
│  POST handler               │
│  - validates CSRF token     │
│  - validates asset ID again │
│  - sets grafana_assets_     │
│    override cookie = "pr-42"│
│  - redirects to /           │
└────────────┬────────────────┘
             │ (redirect)
             ▼
┌─────────────────────────────┐
│  HandleRequest (index.go)   │
│  - reads cookie "pr-42"     │
│  - resolves full URL:       │
│    base_url + "pr-42" + "/" │
│  - GetWebAssets(fullURL)    │
│    - validateOverrideURL()  │
│    - fetch remote manifest  │
│    - use as CDN base        │
│  - render index.html        │
│    with override assets     │
└─────────────────────────────┘
```

## Caching

Remote manifests are cached in-memory with a 30-second TTL, keyed by the override URL. This keeps the TTL short enough that pushing new assets to a PR preview will be picked up quickly, while avoiding an HTTP fetch on every page load.

## CSP considerations

The override asset domain needs to be allowed in `script-src` and `style-src` CSP directives. CSP is configured per-tenant via the Settings Service, so the dev environment can be configured to include the preview asset domain. No code changes are needed for this — it's purely configuration.

## Security considerations

This feature has multiple layers of defense to prevent misuse:

### Startup-time enable gate

The feature is gated by `[server] assets_base_override_enabled` in `grafana.ini`. This is a **startup-time config** — it cannot be set via the Settings Service or any runtime mechanism. It defaults to `false`, so the feature is completely inert in all environments unless explicitly enabled. When disabled, the `/-/set-preview-assets` routes are not registered at all.

```ini
[server]
assets_base_override_enabled = true
```

This means OSS/on-prem Grafana and production cloud environments will never accept override URLs.

### Configured base URL

The base URL for preview assets is configured at startup:

```ini
[server]
assets_base_override_base_url = https://storage.googleapis.com/grafana-preview/
```

The cookie only stores an asset ID (e.g. `pr-12345`), and the full URL is always constructed server-side from this base URL. Users cannot point to an arbitrary domain — the domain is hardcoded in the instance config.

### Asset ID validation

Asset IDs are validated against a strict pattern (`^[a-zA-Z0-9._/-]+$`), limited to 256 characters, and path traversal (`..`) is explicitly rejected. This prevents constructing malicious URLs from the ID.

### CSRF protection on the confirmation page

The `/-/set-preview-assets` endpoint uses the double-submit cookie pattern:
- GET generates a random 32-byte token, stores it in a short-lived (10-minute) HTTP-only cookie scoped to `/-/set-preview-assets`
- POST requires the token in both the form body and the cookie — they must match
- The CSRF cookie uses `SameSite=Strict`, preventing cross-site form submissions

This prevents an attacker from tricking a user into visiting a link that sets the cookie automatically.

### HTTPS enforcement

The resolved override URL must use `https://`. Plain HTTP URLs are rejected to prevent MITM attacks on manifest fetches.

### HTTP-only cookie with expiry

The `grafana_assets_override` cookie is:
- **HTTP-only**: not accessible to JavaScript, preventing XSS exfiltration
- **24-hour expiry**: automatically cleans up, preventing indefinite overrides
- **SameSite=Lax**: prevents cross-site abuse while allowing normal navigation
- **Stores only the ID**: the full URL is resolved server-side, so even if the cookie is tampered with, it can only reference paths under the configured base URL

### Response body size limit

The manifest fetch limits response bodies to 10MB to prevent OOM from malicious or oversized responses.

### GCS bucket hardening

Additional measures to lock down the upload bucket:

- **Dedicated service account**: Create a service account exclusively for CI asset uploads with only `roles/storage.objectCreator` (not `objectAdmin`)
- **Uniform bucket-level access**: Disable ACLs — use IAM only
- **Object lifecycle rules**: Auto-delete objects older than 7 days to limit exposure window
- **VPC Service Controls**: If available, restrict bucket access to the CI network perimeter
- **Signed URLs** (optional): Instead of making the bucket publicly readable, the frontend service could use a GCP service account to generate short-lived signed URLs for manifest fetches. This adds complexity but prevents direct public access to the bucket contents.

## What's out of scope (separate work items)

These are needed to make this fully operational but are outside this change:

| Item | Description |
|------|-------------|
| **CI pipeline job** | Build frontend assets and upload to a bucket on PR events |
| **Bucket/CDN setup** | Configure storage with appropriate CORS headers and public read access |
| **Dev environment config** | Enable `assets_base_override_enabled` and set `assets_base_override_base_url` in the dev cloud environment's grafana.ini |
| **CSP configuration** | Update CSP templates for the dev environment to allow the preview asset domain |
| **Frontend indicator** | Use the `AssetsOverridden` template property to show a visual indicator when preview assets are active |

## How to test locally

Run all the preview assets tests:

```sh
go test ./pkg/services/frontend/ -run TestPreviewAssets -v
go test ./pkg/services/frontend/ -run TestFrontendService_WebAssets/should_serve_index_with_override_assets -v
go test ./pkg/services/frontend/webassets/ -run TestGetWebAssets_AssetsBaseOverrideURL -v
```
