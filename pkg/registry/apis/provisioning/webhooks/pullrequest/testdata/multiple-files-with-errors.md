Hey there! 🎉
Grafana spotted some changes.

| Action | Kind | Resource | Preview | |
|--------|------|----------|---------|-|
| create | Dashboard | Good Dashboard | [preview](http://grafana/admin/preview) | ✅ |
| update | Dashboard | [Bad Dashboard](http://grafana/d/bad) | [preview](http://grafana/admin/preview) | ⚠️ |
| create | Playlist | Broken Playlist |  | ⚠️ |

### ⚠️ Validation Issues

| File | Error |
|------|-------|
| `bad.json` | admission webhook denied: panel type "unknown-panel" is not installed |
| `invalid.yaml` | strict decoding error: unknown field "spec.extra" |