# ngalert API Tooling

## OpenAPI Spec Regeneration

**IMPORTANT:** Whenever you change any struct in the `definitions/` package (add, remove, or rename fields), you MUST regenerate the OpenAPI specs.

### Step 1 — Regenerate the ngalert specs

```bash
make -C pkg/services/ngalert/api/tooling spec.json spec-stable.json fix-spec post.json api.json
```

This regenerates `spec.json`, `spec-stable.json`, `post.json`, and `api.json` from the Go definitions.

### Step 2 — Regenerate the merged public spec

```bash
GODEBUG=gotypesalias=0 swagger mixin -q \
  public/api-spec.json \
  public/api-enterprise-spec.json \
  pkg/services/ngalert/api/tooling/api.json \
  --ignore-conflicts \
  -o public/api-merged.json
```

This merges the OSS, enterprise, and ngalert specs into `public/api-merged.json`, which is tracked in git.

Both `public/api-merged.json` and the files under `pkg/services/ngalert/api/tooling/` (`spec.json`, `spec-stable.json`, `post.json`, `api.json`) must be committed together with the struct change.
