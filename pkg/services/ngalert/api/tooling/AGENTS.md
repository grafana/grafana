# ngalert API Tooling

## OpenAPI Spec Regeneration

**IMPORTANT:** Whenever you change any struct in the `definitions/` package (add, remove, or rename fields), you MUST regenerate the OpenAPI specs.

### Step 1 — Regenerate the ngalert specs

```bash
make -C pkg/services/ngalert/api/tooling spec.json spec-stable.json fix-spec post.json api.json
```

This regenerates `spec.json`, `spec-stable.json`, `post.json`, and `api.json` from the Go definitions.

### Step 2 — Regenerate the merged public spec

Run `make swagger-gen` from the repo root (see root `AGENTS.md` for details).

Both `public/api-merged.json` and the files under `pkg/services/ngalert/api/tooling/` (`spec.json`, `spec-stable.json`, `post.json`, `api.json`) must be committed together with the struct change.