# Text panel sandbox

This document describes the security boundaries of the Text v2 panel when it renders content for a panel with query data, and what a viewer's consent to load a blocked source grants. Read it before you change `SandboxFrame.tsx`, `sandboxPolicy.ts`, `sandboxRuntime.ts`, `sandboxProtocol.ts`, or `public/app/features/dashboard-scene/scene/sandbox-consent/`.

The user-facing version is the "Security and external content" section of the Text visualization docs.

## Threat model

Panel content is untrusted. A dashboard editor, a provisioned dashboard, a dashboard variable, or a query result can all put content into it. Handlebars and variable interpolation run before rendering, so query data and variable values can appear anywhere in the HTML, including in URLs. Sanitization runs after interpolation, so it covers interpolated values too.

The sandbox protects:

- The viewer's Grafana session, cookies, and API access.
- The DOM and state of the Grafana app, including other panels.
- Dashboard data, from being sent to third parties without the viewer's consent.

## Boundaries

### Template execution

Text v2 runs Handlebars compilation and rendering in a separate hidden opaque frame before
sanitization. See [Handlebars execution sandbox](templateSandbox/README.md) for its nonce
compiler, helper bridge, limits, and tests. It does not require `unsafe-eval`. Changes to that
compiler, its Trusted Types policies, or its message bridge also require security review.

### Frame isolation

`SandboxFrame` renders content in an iframe with these sandbox flags:

- `allow-scripts`: Only for the runtime. The CSP limits scripts to the runtime's nonce.
- `allow-popups`, `allow-popups-to-escape-sandbox`: Links open as normal tabs. `<base target="_blank">` makes this the default.
- `allow-top-navigation-by-user-activation`: A user click can navigate the Grafana tab.

The flags don't include `allow-same-origin`, so the frame has an opaque origin. It can't read Grafana cookies, storage, or the parent DOM, and its requests carry no Grafana credentials. Nested frames inherit these flags. The frame also uses `referrerPolicy="no-referrer"` and turns off DNS prefetch.

### Content Security Policy

`textSandboxPolicy` builds the frame's CSP. `buildFrameShell` replaces `script-src 'none'` with the runtime's nonce and writes the policy as a `<meta>` tag. A `srcdoc` frame also inherits Grafana's own CSP, so the shell reuses the server's nonce when there is one. Because a CSP can't be relaxed in place, a policy change creates a new frame document.

| Directive     | Value without consent      | Added by consent |
| ------------- | -------------------------- | ---------------- |
| `default-src` | `'none'`                   |                  |
| `script-src`  | Runtime nonce only         |                  |
| `style-src`   | `'unsafe-inline'`          | Allowed origins  |
| `img-src`     | `data:`                    | Allowed origins  |
| `font-src`    | `data:`, Grafana font path | Allowed origins  |
| `media-src`   | `'none'`                   | Allowed origins  |
| `frame-src`   | `'none'`                   | Allowed origins  |
| `object-src`  | `'none'`                   |                  |
| `connect-src` | `'none'`                   |                  |
| `base-uri`    | `'none'`                   |                  |
| `form-action` | `'none'`                   |                  |

The font exception covers only Grafana's font path, not all same-origin resources. The parent also inlines Grafana's global `@font-face` rules as `data:` URLs.

Before it reports `ready`, the runtime loads a probe image from `CSP_CHECK_URL` and waits for the CSP violation event. If the browser doesn't deliver violation events, the frame never receives content, and the watchdog fails the panel after `WATCHDOG_TIMEOUT_MS`. The runtime only reports violations of its own policy, not of an inherited one.

### Sanitization

The parent sanitizes HTML with `sanitizeTextPanelContent` before it sends it to the frame. This happens even when `disable_sanitize_html` is enabled. Mermaid source loads from Grafana's bundle through the parent, and the runtime sanitizes Mermaid SVG output with DOMPurify. The parent only uses the Trusted Types policy `grafana-text-panel-shell` for the shell that `buildFrameShell` generates. Panel HTML never goes through it. It arrives later by message.

### Message channel

The parent and the frame talk over `postMessage` with the `grafana-text-frame-v1` protocol. The parent accepts a message only when all of the following are true:

- `event.source` is this iframe's `contentWindow`.
- `event.origin` is `'null'`, the opaque origin.
- The message has this frame's random `channel` id and passes `isFrameNotification`.

The parent treats every report from the frame as untrusted:

- It drops reported URLs whose origin doesn't match the origin they're reported under.
- It caps blocked URLs at `MAX_BLOCKED_URL_CHARS` per directive and origin, and URL counts at `MAX_BLOCKED_URL_COUNT`. A source over the cap is marked `truncated`, never listed in part.
- It ignores resize values outside a fixed range.

## Consent

The frame reports CSP violations for the directives in `RESOURCE_DIRECTIVES`. `TextSandbox` groups them by origin and passes them to `sandboxConsent.ts`, which feeds the dashboard banner and the review modal.

### What an approval grants

An approval adds an origin, not a URL, to `style-src`, `img-src`, `font-src`, `media-src`, and `frame-src`. The modal lists every URL so the viewer can see what data leaves, but the grant covers anything on that origin. The frame stays isolated after an approval: scripts, `connect-src`, forms, and objects stay blocked.

After an approval, the allowed origin can:

- Receive any data that the panel puts into URLs, such as variables and query results.
- See the viewer's IP address, user agent, and view time. It doesn't get a referrer.
- Serve different content than it did when the viewer reviewed it.
- Load further images, fonts, and stylesheets from its own stylesheets, but only from origins the viewer allowed.
- Run scripts in a nested iframe that it serves. That frame inherits the sandbox flags and an opaque origin, but it isn't bound by this CSP, so it can make its own network requests and show any UI, such as a fake login form.

A truncated source can't be allowed, because the viewer can't review all of its URLs.

### Scope and storage

| Option       | Applies to                                         | Lasts                    | Stored in        |
| ------------ | -------------------------------------------------- | ------------------------ | ---------------- |
| Allow        | The panels listed in the review, on that dashboard | Until the tab closes     | `sessionStorage` |
| Always allow | Every Text v2 panel on every dashboard             | `ALWAYS_ALLOW_DAYS` (30) | `localStorage`   |

Both keys include the org id and user id, because browser storage survives logout and org switches. Consent is per browser and is never sent to the server or shared with other users.

"Allow" is keyed by dashboard uid and panel id:

- A panel that wasn't rendered when the viewer allowed a source wasn't reviewed, so the approval doesn't cover it.
- When a new dashboard gets its uid on first save, `copyDashboardConsent` copies the approval to the new uid.
- `clearUnsavedDashboardConsent` clears approvals for unsaved dashboards, so a new dashboard doesn't inherit them from the last one.

"Always allow" expires while the page is open too, so a dashboard on a TV doesn't keep an expired approval. Other tabs pick up "Always allow" changes through storage events. "Allow" stays in the tab where the viewer gave it. If storage is blocked, consent lasts until the page reloads.

## Changing the sandbox

Treat these changes as security changes and get a security review:

- Adding a sandbox flag, especially `allow-same-origin`, `allow-forms`, or `allow-top-navigation`.
- Adding a directive or source to the CSP, or adding a directive to the ones that consent extends.
- Changing which messages the parent accepts, or trusting a value from the frame.
- Widening consent scope or duration, or moving consent out of per-user browser storage.
