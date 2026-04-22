Hey there! 👋
Grafana spotted 3 changes (2 with issues).

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