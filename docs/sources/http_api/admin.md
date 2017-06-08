+++
title = "Admin HTTP API "
description = "Grafana Admin HTTP API"
keywords = ["grafana", "http", "documentation", "api", "admin"]
aliases = ["/http_api/admin/"]
type = "docs"
[menu.docs]
name = "Admin"
parent = "http_api"
+++

# Admin API

The admin http API does not currently work with an api token. Api Token's are currently only linked to an organization and organization role. They cannot given
the permission of server admin, only user's can be given that permission. So in order to use these API calls you will have to use basic auth and Grafana user
with Grafana admin permission.

## Settings

`GET /api/admin/settings`

**Example Request**:

    GET /api/admin/settings
    Accept: application/json
    Content-Type: application/json

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {
    "DEFAULT":
    {
      "app_mode":"production"},
      "analytics":
      {
        "google_analytics_ua_id":"",
        "reporting_enabled":"false"
      },
      "auth.anonymous":{
        "enabled":"true",
        "org_name":"Main Org.",
        "org_role":"Viewer"
      },
      "auth.basic":{
        "enabled":"false"
      },
      "auth.github":{
        "allow_sign_up":"false",
        "allowed_domains":"",
        "allowed_organizations":"",
        "api_url":"https://api.github.com/user",
        "auth_url":"https://github.com/login/oauth/authorize",
        "client_id":"some_id",
        "client_secret":"************",
        "enabled":"false",
        "scopes":"user:email",
        "team_ids":"",
        "token_url":"https://github.com/login/oauth/access_token"
      },
      "auth.google":{
        "allow_sign_up":"false","allowed_domains":"",
        "api_url":"https://www.googleapis.com/oauth2/v1/userinfo",
        "auth_url":"https://accounts.google.com/o/oauth2/auth",
        "client_id":"some_client_id",
        "client_secret":"************",
        "enabled":"false",
        "scopes":"https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
        "token_url":"https://accounts.google.com/o/oauth2/token"
      },
      "auth.ldap":{
        "config_file":"/etc/grafana/ldap.toml",
        "enabled":"false"
      },
      "auth.proxy":{
        "auto_sign_up":"true",
        "enabled":"false",
        "header_name":"X-WEBAUTH-USER",
        "header_property":"username"
      },
      "dashboards.json":{
        "enabled":"false",
        "path":"/var/lib/grafana/dashboards"
      },
      "database":{
        "host":"127.0.0.1:0000",
        "name":"grafana",
        "password":"************",
        "path":"grafana.db",
        "ssl_mode":"disable",
        "type":"sqlite3",
        "user":"root"
      },
      "emails":{
        "templates_pattern":"emails/*.html",
        "welcome_email_on_sign_up":"false"
      },
      "event_publisher":{
        "enabled":"false",
        "exchange":"grafana_events",
        "rabbitmq_url":"amqp://localhost/"
      },
      "log":{
        "buffer_len":"10000",
        "level":"Info",
        "mode":"file"
      },
      "log.console":{
        "level":""
      },
      "log.file":{
        "daily_rotate":"true",
        "file_name":"",
        "level":"",
        "log_rotate":"true",
        "max_days":"7",
        "max_lines":"1000000",
        "max_lines_shift":"28",
        "max_size_shift":""
      },
      "paths":{
        "data":"/tsdb/grafana",
        "logs":"/logs/apps/grafana"},
        "security":{
        "admin_password":"************",
        "admin_user":"admin",
        "cookie_remember_name":"grafana_remember",
        "cookie_username":"grafana_user",
        "disable_gravatar":"false",
        "login_remember_days":"7",
        "secret_key":"************"
      },
      "server":{
        "cert_file":"",
        "cert_key":"",
        "domain":"mygraf.com",
        "enable_gzip":"false",
        "enforce_domain":"false",
        "http_addr":"127.0.0.1",
        "http_port":"0000",
        "protocol":"http",
        "root_url":"%(protocol)s://%(domain)s:%(http_port)s/",
        "router_logging":"true",
        "data_proxy_logging":"true",
        "static_root_path":"public"
      },
      "session":{
        "cookie_name":"grafana_sess",
        "cookie_secure":"false",
        "gc_interval_time":"",
        "provider":"file",
        "provider_config":"sessions",
        "session_life_time":"86400"
      },
      "smtp":{
        "cert_file":"",
        "enabled":"false",
        "from_address":"admin@grafana.localhost",
        "from_name":"Grafana",
        "host":"localhost:25",
        "key_file":"",
        "password":"************",
        "skip_verify":"false",
        "user":""},
      "users":{
        "allow_org_create":"true",
        "allow_sign_up":"false",
        "auto_assign_org":"true",
        "auto_assign_org_role":"Viewer"
      }
    }

## Grafana Stats

`GET /api/admin/stats`

**Example Request**:

    GET /api/admin/stats
    Accept: application/json
    Content-Type: application/json

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {
      "user_count":2,
      "org_count":1,
      "dashboard_count":4,
      "db_snapshot_count":2,
      "db_tag_count":6,
      "data_source_count":1,
      "playlist_count":1,
      "starred_db_count":2,
      "grafana_admin_count":2
    }

## Global Users

`POST /api/admin/users`

Create new user

**Example Request**:

    POST /api/admin/users HTTP/1.1
    Accept: application/json
    Content-Type: application/json

    {
      "name":"User",
      "email":"user@graf.com",
      "login":"user",
      "password":"userpassword"
    }

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"id":5,"message":"User created"}

## Password for User

`PUT /api/admin/users/:id/password`

Change password for specific user

**Example Request**:

    PUT /api/admin/users/2/password HTTP/1.1
    Accept: application/json
    Content-Type: application/json

    {"password":"userpassword"}

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"message": "User password updated"}

## Permissions

`PUT /api/admin/users/:id/permissions`

**Example Request**:

    PUT /api/admin/users/2/permissions HTTP/1.1
    Accept: application/json
    Content-Type: application/json

    {"isGrafanaAdmin": true}

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {message: "User permissions updated"}

## Delete global User

`DELETE /api/admin/users/:id`

**Example Request**:

    DELETE /api/admin/users/2 HTTP/1.1
    Accept: application/json
    Content-Type: application/json

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {message: "User deleted"}

## Pause all alerts

`POST /api/admin/pause-all-alerts`

**Example Request**:

    POST /api/admin/pause-all-alerts HTTP/1.1
    Accept: application/json
    Content-Type: application/json

    {
      "paused": true
    }

JSON Body schema:

- **paused** – If true then all alerts are to be paused, false unpauses all alerts.

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {state: "new state", message: "alerts pause/un paused", "alertsAffected": 100}
