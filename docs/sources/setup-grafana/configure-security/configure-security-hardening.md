---
aliases:
  - /docs/grafana/latest/setup-grafana/configure-security/configure-security-hardening/
description: Security hardening enables you to apply additional security which might stop certain vulnerabilities from being exploited by a malicious attacker.
title: Configure security hardening
---

# Configure security hardening

Security hardening enables you to apply additional security which might stop certain vulnerabilities from being exploited by a malicious attacker.

> **Note:** These settings are available in the [grafana.ini configuration file]({{< relref "../configure-grafana/#configuration-file-location" >}}). To apply changes to the configuration file, restart the Grafana server.

## Additional security for cookies

If Grafana uses HTTPS, it is possible to further secure the cookie that is used as authentication to access the Web UI. By securing the cookie further, you might mitigate against certain attacks where an attacker could get hold of the cookie value.

> **Note:** Grafana must use HTTPS in order for the below configurations to work properly.

### Add a secure attribute to cookies

The secure attribute will add a `Secure` attribute to the cookie that is used to authenticate users and enforces users to only send the cookie over a valid HTTPS secure connection. This configuration provides mitigation against some MITM attacks.

Example:

```toml
# Set to true if you host Grafana behind HTTPS. The default value is false.
cookie_secure = true
```

### Add a SameSite attribute to cookies

Set the _cookie_samesite_ option to `strict`. This will enforce clients to not send the cookie in requests that were made cross-site, but only from the site that sat the cookie. By setting the option to "strict", you will mitigate almost all CSRF-attacks.

Example:

```toml
# set cookie SameSite attribute. defaults to `lax`. can be set to "lax", "strict", "none" and "disabled"
cookie_samesite = strict
```

> **Note:** By setting the SameSite attribute to "strict", clicks to the Grafana instance will not work, just within the instance. The default option "lax" does not have this behavior.

### Add a prefix to cookie names

Further secure the cookie authentication by adding a [Cookie Prefix](https://googlechrome.github.io/samples/cookie-prefixes/). Cookies without a special prefix can be overwritten in a man-in-the-middle attack, even if the site is using HTTPS. A cookie prefix will enforce clients to only accept the cookie if certain criteria are met.
Prefix the current cookie name with either `__Secure-` or `__Host-` where the latter adds additional protection by only alloing the cookie to be sat from the host that sent the Set-Cookie header.

Example:

```toml
# Login cookie name
login_cookie_name = __Host-grafana_session
```

## Security headers

Grafana has a few additional headers that can be configured which might help to mitigate against certain attacks such as XSS.

### Add a Content Security Policy

A content security policy (CSP) is a HTTP response header that instructs the web browser how content should be handled, such as allowing inline scripts to execute, or loading images from certain domains. The default CSP template is already configured to provide sufficient protection against some attacks. This will make it more difficult for attackers to execute arbitrary JavaScript if such a vulnerability would be present.

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

### Hide the version number

If set to `true`, the Grafana server will hide the running version number for unauthenticated users. Version numbers might reveal if you are running an outdated and vulnerable version of Grafana.

Example:

```toml
# mask the Grafana version number for unauthenticated users
hide_version = true
```

### Enforce domain verification

If set to `true`, the Grafana server will redirect requests that have a Host-header value that is mismatched to the actual domain. This might help to mitigate against some DNS rebinding attacks.

Example:

```toml
# Redirect to correct domain if host header does not match domain
# Prevents DNS rebinding attacks
enforce_domain = true
```
