# OAUTH BLOCK

## Devenv setup oauth

To launch the block, use the oauth source. Ex:
```bash
make devenv sources="auth/oauth"
```

Here is the conf you need to add to your configuration file (conf/custom.ini):

```ini
[auth.generic_oauth]
enabled = true
name = Keycloak-OAuth
allow_sign_up = true
client_id = grafana-oauth
client_secret = d17b9ea9-bcb1-43d2-b132-d339e55872a8
scopes = openid email profile offline_access roles
email_attribute_path = email
login_attribute_path = username
name_attribute_path = full_name
groups_attribute_path = groups
auth_url = http://localhost:8087/realms/grafana/protocol/openid-connect/auth
token_url = http://localhost:8087/realms/grafana/protocol/openid-connect/token
role_attribute_path = contains(roles[*], 'grafanaadmin') && 'GrafanaAdmin' || contains(roles[*], 'admin') && 'Admin' || contains(roles[*], 'editor') && 'Editor' || 'Viewer'
allow_assign_grafana_admin = true
signout_redirect_url = http://localhost:8087/realms/grafana/protocol/openid-connect/logout?post_logout_redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Flogin
```

## Devenv setup jwt auth

To launch the block, use the oauth source. Ex:

```bash
make devenv sources="auth/oauth"
```

Here is the conf you need to add to your configuration file (conf/custom.ini):

```ini
[auth.jwt]
enabled = true
header_name = X-JWT-Assertion
username_claim = preferred_username
email_claim = email
jwk_set_file = devenv/docker/blocks/auth/oauth/jwks.json
cache_ttl = 60m
expect_claims = {"iss": "http://localhost:8087/realms/grafana", "azp": "grafana-oauth"}
auto_sign_up = true
role_attribute_path = contains(roles[*], 'grafanaadmin') && 'GrafanaAdmin' || contains(roles[*], 'admin') && 'Admin' || contains(roles[*], 'editor') && 'Editor' || 'Viewer'
role_attribute_strict = true
allow_assign_grafana_admin = true
```

You can obtain a jwt token by using the following command for oauth-admin:

```sh
curl --request POST \
  --url http://localhost:8087/realms/grafana/protocol/openid-connect/token \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data client_id=grafana-oauth \
  --data grant_type=password \
  --data client_secret=d17b9ea9-bcb1-43d2-b132-d339e55872a8 \
  --data scope=openid \
  --data username=oauth-admin \
  --data password=grafana
```


Grafana call example:

```sh
curl --request GET \
  --url http://127.0.0.1:3000/api/folders \
  --header 'Accept: application/json' \
  --header 'X-JWT-Assertion: eyJ......'
```

### Alternative devenv setup jwk_set_url

Run a reverse proxy pointing to the jwk_set_url (only an https-uri can be used as jwk_set_url).

Ex (using localtunnel):

```sh
npx localtunnel --port 8087
```

And using the following conf:

```ini
[auth.jwt]
enabled = true
header_name = X-JWT-Assertion
username_claim = login
email_claim = email
jwk_set_url = <YOUR REVERSE PROXY URL>/auth/realms/grafana/protocol/openid-connect/certs
cache_ttl = 60m
expect_claims = {"iss": "http://localhost:8087/auth/realms/grafana", "azp": "grafana-oauth"}
auto_sign_up = true
```

## Backing up keycloak DB

In case you want to make changes to the devenv setup, you can dump keycloak's DB:

```bash
cd devenv;
docker-compose exec -T oauthkeycloakdb bash -c "pg_dump -U keycloak keycloak" > docker/blocks/auth/oauth/cloak.sql
```

## Connecting to keycloak:

- keycloak admin:                     http://localhost:8087
- keycloak admin login:               admin:admin
- grafana oauth viewer login:         oauth-viewer:grafana
- grafana oauth editor login:         oauth-editor:grafana
- grafana oauth admin login:          oauth-admin:grafana
- grafana oauth server admin login:   oauth-grafanaadmin:grafana
