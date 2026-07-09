📋 Grafana detected **3** resource change(s) in this pull request — ⚠️ 2 need attention.

| Action | Kind | Resource | Preview | Status |
|--------|------|----------|---------|--------|
| create | Dashboard | Good Dashboard | [preview](http://grafana/admin/preview) | ✅ |
| update | Dashboard | [Bad Dashboard](http://grafana/d/bad) | [preview](http://grafana/admin/preview) | ⚠️ |
| create | Playlist | Broken Playlist |  | ⚠️ |

### ⚠️ Validation Issues

| File | Error |
|------|-------|
| `bad.json` | admission webhook denied: panel type "unknown-panel" is not installed |
| `invalid.yaml` | strict decoding error: unknown field "spec.extra" |

---
_Posted by [host](http://host/)_