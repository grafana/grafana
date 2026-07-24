📋 Grafana detected **3** resource changes in this pull request — ⚠️ 2 need attention.

| Action | Kind | Resource | File | Preview | Status |
|--------|------|----------|------|---------|--------|
| ➕ Added | Dashboard | Good Dashboard | good.json | [preview](http://grafana/admin/preview) | ✅ |
| ✏️ Updated | Dashboard | [Bad Dashboard](http://grafana/d/bad) | bad.json | [preview](http://grafana/admin/preview) | ⚠️ |
| ➕ Added | Playlist | Broken Playlist | invalid.yaml |  | ⚠️ |

### ⚠️ Validation Issues

| File | Error |
|------|-------|
| `bad.json` | admission webhook denied: panel type "unknown-panel" is not installed |
| `invalid.yaml` | strict decoding error: unknown field "spec.extra" |

---
_Posted by [host](http://host/)_