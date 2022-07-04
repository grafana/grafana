# OAUTH BLOCK

## Devenv setup

To launch the block, use the oauth source. Ex:
```bash
make devenv sources="oauth"
```

Here is the conf you need to add to your configuration file (conf/custom.ini):

```ini
[auth]
signout_redirect_url = http://localhost:8087/auth/realms/grafana/protocol/openid-connect/logout?redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Flogin

[auth.generic_oauth]
enabled = true
name = Keycloak-OAuth
allow_sign_up = true
client_id = grafana-oauth
client_secret = d17b9ea9-bcb1-43d2-b132-d339e55872a8
empty_scopes = true
email_attribute_path = email
login_attribute_path = login
name_attribute_path = name
auth_url = http://localhost:8087/auth/realms/grafana/protocol/openid-connect/auth
token_url = http://localhost:8087/auth/realms/grafana/protocol/openid-connect/token
api_url = http://localhost:8087/auth/realms/grafana/protocol/openid-connect/userinfo
role_attribute_path = contains(roles[*], 'admin') && 'Admin' || contains(roles[*], 'editor') && 'Editor' || 'Viewer'
```

## Backing up keycloak DB

In case you want to make changes to the devenv setup, you can dump keycloack's DB:

```bash
cd devenv;
docker-compose exec -T oauthkeycloakdb bash -c "pg_dump -U keycloak keycloak" > docker/blocks/oauth/cloak.sql
```

## Connecting to keycloack:

- keycloak admin:                     http://localhost:8087
- keycloak admin login:               admin:admin
- grafana oauth viewer login:          oauth-viewer:grafana
- grafana oauth editor login:          oauth-editor:grafana
- grafana oauth admin login:           oauth-admin:grafana

# Troubleshooting

## Mac M1 Users

The new arm64 architecture does not build for the latest docker image of keycloack. Refer to https://github.com/docker/for-mac/issues/5310 for the issue to see if it resolved.
Until then you need to build the docker image locally and then run `devenv`.

1. Remove any lingering keycloack image
```sh
$ docker rmi $(docker images | grep 'keycloack')
```
1. Build keycloack image locally
```sh
$ ./docker-build-keycloack-m1-image.sh
```
1. Start from beginning of this readme

