# User simulation — CLI / automated testing

Grafana admins can simulate another user’s permissions in a **browser session**. The same session works from the CLI if you log in and reuse the session cookie.

**Requirements**

- Caller must be a **Grafana server admin**.
- Target user must be a member of the **active org** for that session (match org via UI org switcher first, or ensure default org is correct).
- Uses **session auth** (not API keys). Middleware: [`user_simulation.go`](../../middleware/user_simulation.go).
- HTTP handlers: [`api.go`](./api.go).

## Environment

Set base URL and credentials (defaults match local dev):

```bash
export GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"
export GRAFANA_USER="${GRAFANA_USER:-admin}"
export GRAFANA_PASSWORD="${GRAFANA_PASSWORD:-admin}"
```

If Grafana is under a subpath, include it in `GRAFANA_URL` (e.g. `http://localhost:3000/grafana`).

## 1. Log in and store session cookies

```bash
curl -sS -c grafana-cookies.txt \
  -H 'Content-Type: application/json' \
  -d "{\"user\":\"${GRAFANA_USER}\",\"password\":\"${GRAFANA_PASSWORD}\"}" \
  "${GRAFANA_URL}/login"
```

Expect HTTP `200` and `{"message":"Logged in",...}`. Session is in `grafana-cookies.txt` (cookie name is usually `grafana_session`).

## 2. Start simulation

Replace `TARGET_USER_ID` with the numeric user id to simulate:

```bash
curl -sS -b grafana-cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"userId":TARGET_USER_ID}' \
  "${GRAFANA_URL}/api/admin/user-simulation"
```

Subsequent requests with the **same** cookie jar hit the updated token row on the server; the next `GET /api/user` (and everything except `/api/admin/user-simulation`) runs as the simulated user.

## 3. Assert simulated identity

Example: current user should match the target:

```bash
curl -sS -b grafana-cookies.txt "${GRAFANA_URL}/api/user" | jq .
```

Check `login`, `orgId`, `isGrafanaAdmin`, and permissions vs the simulated user.

## 4. Status (optional)

```bash
curl -sS -b grafana-cookies.txt "${GRAFANA_URL}/api/admin/user-simulation"
```

Returns whether simulation is active and ids/logins (admin context; this path is not identity-swapped).

## 5. Stop simulation

```bash
curl -sS -b grafana-cookies.txt -X DELETE \
  "${GRAFANA_URL}/api/admin/user-simulation"
```

Reload or continue with the same cookie jar; next API calls use the admin again.

## Automated checks (sketch)

1. Login → save cookies.
2. `GET /api/user` → record `id` as admin.
3. `POST /api/admin/user-simulation` with known `userId` in same org.
4. `GET /api/user` → assert `id` equals target and `isGrafanaAdmin` matches expectation.
5. `DELETE /api/admin/user-simulation`.
6. `GET /api/user` → assert back to admin.

## Troubleshooting

| Issue | Likely cause |
|-------|----------------|
| `400` on POST | Target user not in current org, service account, disabled, or same as signed-in admin (cannot simulate yourself). |
| `403` on POST | Not Grafana server admin. |
| `400` “browser session” | No session token; login via `/login` first. |
| CSRF on login | Match `root_url`/origin or adjust CSRF settings for your environment. |
