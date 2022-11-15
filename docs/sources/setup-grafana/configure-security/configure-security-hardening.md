---
aliases:
  - /docs/grafana/latest/setup-grafana/configure-security/configure-security-hardening/
description: Security hardening enables you to apply additional security which might stop certain vulnerabilities from being exploited by a malicious attacker. 
title: Configure security hardening
---

# Configure  security hardening

Security hardening enables you to apply additional security which might stop certain vulnerabilities from being exploited by a malicious attacker. 

## Cookies

 If Grafana uses HTTPS, it is possible to further secure the cookie that is used as authentication to access the Web UI.

> **Note:** Grafana must use HTTPS in order for the below configurations to work properly.

### Secure cookie attribute

Set the *cookie_secure* option to `true`. This will enforce clients to set and send the cookie over a (valid HTTPS) secure connection to help mitigate against some MITM-attacks. 

Example:
```toml
# set to true if you host Grafana behind HTTPS. default is false.
cookie_secure = true
```


### SameSite cookie attribute

Set the *cookie_samesite* option to `strict`. This will enforce clients to not send the cookie in requests that were made cross-site, but only from the site that sat the cookie. By setting the option to "strict", you will mitigate almost all CSRF-attacks. 

Example:
  ```toml
# set cookie SameSite attribute. defaults to `lax`. can be set to "lax", "strict", "none" and "disabled"
cookie_samesite = strict
```
  
> **Note:** By setting the SameSite attribute to "strict", clicks to the Grafana instance will not work, just within the instance. The default option "lax" does not have this behavior. 


### Cookie prefix

Further secure the cookie authentication by adding a [Cookie Prefix](https://googlechrome.github.io/samples/cookie-prefixes/). A cookie prefix will enforce clients to only accept the cookie if certain criterias are met. Prefix the current cookie name with either `__Secure-` or `__Host-` where the latter adds additional protection. 

Example:
  ```toml
# Login cookie name
login_cookie_name = __Host-grafana_session
```


## Security headers

Grafana has a few additional headers that can be configured which might help to mitigate against certain attacks such as XSS.

### Content Security Policy

The default CSP template is already configured to provide sufficient protection against some attacks.

Example:
  ```toml
# Enable adding the Content-Security-Policy header to your requests.
# CSP allows to control resources the user agent is allowed to load and helps prevent XSS attacks.
content_security_policy = true

# Set Content Security Policy template used when adding the Content-Security-Policy header to your requests.
# $NONCE in the template includes a random nonce.
# $ROOT_PATH is server.root_url without the protocol.
content_security_policy_template = """script-src 'self' 'unsafe-eval' 'unsafe-inline' 'strict-dynamic' $NONCE;object-src 'none';font-src 'self';style-src 'self' 'unsafe-inline' blob:;img-src * data:;base-uri 'self';connect-src 'self' grafana.com ws://$ROOT_PATH wss://$ROOT_PATH;manifest-src 'self';media-src 'none';form-action 'self';"""
```


## Additional security hardening 

### Hide version
If set to `true`, Grafana will redirect requests that have a Host-header value that is mismatched to the actual domain. This might help to mitigate against some DNS rebinding attacks.

Example:
  ```toml
# Redirect to correct domain if host header does not match domain
# Prevents DNS rebinding attacks
enforce_domain = true
```


### Enforce domain verification
If set to `true`, Grafana will hide the version number for unauthenticated users. Version numbers might reveal if you are running an outdated and vulnerable version of Grafana.

Example:
  ```toml
# mask the Grafana version number for unauthenticated users
hide_version = true
```
