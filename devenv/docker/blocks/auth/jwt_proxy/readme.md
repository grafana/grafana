# JWT PROXY BLOCK
## Devenv setup jwt auth

To launch the block, use the oauth source. Ex:

```bash
make devenv sources="auth/jwt_proxy"
```

Here is the conf you need to add to your configuration file (conf/custom.ini):

```ini
[auth]
signout_redirect_url = http://env.grafana.local:8088/oauth2/sign_out

[auth.jwt]
enabled = true
header_name = X-Forwarded-Access-Token
username_claim = login
email_claim = email
jwk_set_file = devenv/docker/blocks/auth/oauth/jwks.json
cache_ttl = 60m
expected_claims = {"iss": "http://env.grafana.local:8087/auth/realms/grafana", "azp": "grafana-oauth"}
auto_sign_up = true
role_attribute_path = contains(roles[*], 'grafanaadmin') && 'GrafanaAdmin' || contains(roles[*], 'admin') && 'Admin' || contains(roles[*], 'editor') && 'Editor' || 'Viewer'
role_attribute_strict = false
allow_assign_grafana_admin = true
```

Add *env.grafana.local* to /etc/hosts (Mac/Linux) or C:\Windows\System32\drivers\etc\hosts (Windows):
```ini
127.0.0.1   env.grafana.local
::1         env.grafana.local
```

Access Grafana through: 

```sh
http://env.grafana.local:8088
```

## Devenv setup jwt auth iframe embedding

- Add previous configuration and next snippet to grafana.ini

```ini
[security]
allow_embedding = true
```

- Create dashboard and copy UID

- Clone [https://github.com/grafana/grafana-iframe-oauth-sample](https://github.com/grafana/grafana-iframe-oauth-sample)

- Change the dashboard URL in `grafana-iframe-oauth-sample/src/pages/restricted.tsx` to use the dashboard you created (keep URL query values)

- Start sample app from the `grafana-iframe-oauth-sample` folder with: `yarn start`

- Navigate to [http://localhost:4200](http://localhost:4200) and press restricted area

Note: You may need to grant the JWT user in grafana access to the datasources and the dashboard

## Backing up keycloak DB

In case you want to make changes to the devenv setup, you can dump keycloak's DB:

```bash
cd devenv;
docker-compose exec -T oauthkeycloakdb bash -c "pg_dump -U keycloak keycloak" > docker/blocks/auth/jwt_proxy/cloak.sql
```

## Connecting to keycloak:

- keycloak admin:                     http://localhost:8087
- keycloak admin login:               admin:admin
- grafana jwt viewer login:          jwt-viewer:grafana
- grafana jwt editor login:          jwt-editor:grafana
- grafana jwt admin login:           jwt-admin:grafana

# Troubleshooting

## Mac M1 Users

The new arm64 architecture does not build for the latest docker image of keycloak. Refer to https://github.com/docker/for-mac/issues/5310 for the issue to see if it resolved.
Until then you need to build the docker image locally and then run `devenv`.

1. Remove any lingering keycloak image
```sh
$ docker rmi $(docker images | grep 'keycloak')
```
1. Build keycloak image locally
```sh
$ ./docker-build-keycloak-m1-image.sh
```
1. Start from beginning of this readme

## Docker for Windows Users

### Docker for Windows with WSL 2

Port forwarding needs to be set up between the WSL 2 VM (which runs Grafana, in my case it is Ubuntu) and the host system. (https://docs.microsoft.com/en-us/windows/wsl/networking)

Run the following commands from an elevated PowerShell prompt:
1. Change the default WSL 2 distribution if necessary
```powershell
wsl --list # Find the default
wsl -s Ubuntu # Change the default
```
2. Open port 3000 between the Windows host and the WSL 2 VM
```powershell
$hostAddr = '0.0.0.0';
$wslHostAddr = wsl hostname -I;
iex "netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=$hostAddr"
iex "netsh interface portproxy add v4tov4 listenport=3000 listenaddress=$hostAddr connectport=3000 connectaddress=$wslHostAddr"
```

Tested on Win 11 Home, Ubuntu and Docker for Windows v4.11.1 (84025).
