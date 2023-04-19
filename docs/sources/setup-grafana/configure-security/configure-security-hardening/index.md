---
aliases:
  - /docs/grafana/latest/setup-grafana/configure-security/configure-security-hardening/
description: Security hardening enables you to apply additional security which might stop certain vulnerabilities from being exploited by a malicious attacker.
title: Configure security hardening
---

# Configure security hardening

Security hardening enables you to apply additional security, which can help stop certain vulnerabilities from being exploited by a malicious attacker.

> **Note:** These settings are available in the [grafana.ini configuration file]({{< relref "../../configure-grafana/#configuration-file-location" >}}). To apply changes to the configuration file, restart the Grafana server.

## Additional security for cookies

If Grafana uses HTTPS, you can further secure the cookie that the system uses to authenticate access to the web UI. By applying additional security to the cookie, you might mitigate certain attacks that result from an attacker obtaining the cookie value.

> **Note:** Grafana must use HTTPS for the following configurations to work properly.

### Add a secure attribute to cookies

To provide mitigation against some MITM attacks, add the `Secure` attribute to the cookie that is used to authenticate users. This attribute forces users only to send the cookie over a valid HTTPS secure connection.

Example:

```toml
# Set to true if you host Grafana behind HTTPS. The default value is false.
cookie_secure = true
```

### Add a SameSite attribute to cookies

To mitigate almost all CSRF-attacks, set the _cookie_samesite_ option to `strict`. This setting prevents clients from sending the cookie in requests that are made cross-site, but only from the site that creates the cookie.

Example:

```toml
# set cookie SameSite attribute. defaults to `lax`. can be set to "lax", "strict", "none" and "disabled"
cookie_samesite = strict
```

> **Note:** By setting the SameSite attribute to "strict," only the user clicks within a Grafana instance work. The default option, "lax," does not produce this behavior.

### Add a prefix to cookie names

You can further secure the cookie authentication by adding a [Cookie Prefix](https://googlechrome.github.io/samples/cookie-prefixes/). Cookies without a special prefix can be overwritten in a man-in-the-middle attack, even if the site uses HTTPS. A cookie prefix forces clients only to accept the cookie if certain criteria are met.
Add a prefix to the current cookie name with either `__Secure-` or `__Host-` where the latter provides additional protection by only allowing the cookie to be created from the host that sent the Set-Cookie header.

Example:

```toml
# Login cookie name
login_cookie_name = __Host-grafana_session
```

## Security headers

Grafana includes a few additional headers that you can configure to help mitigate against certain attacks, such as XSS.

### Add a Content Security Policy

A content security policy (CSP) is an HTTP response header that controls how the web browser handles content, such as allowing inline scripts to execute or loading images from certain domains. The default CSP template is already configured to provide sufficient protection against some attacks. This makes it more difficult for attackers to execute arbitrary JavaScript if such a vulnerability is present.

Example:

```toml
# Enable adding the Content-Security-Policy header to your requests.
# CSP enables you to control the resources the user agent can load and helps prevent XSS attacks.
content_security_policy = true

# Set the Content Security Policy template that is used when the Content-Security-Policy header is added to your requests.
# $NONCE in the template includes a random nonce.
# $ROOT_PATH is server.root_url without the protocol.
content_security_policy_template = """script-src 'self' 'unsafe-eval' 'unsafe-inline' 'strict-dynamic' $NONCE;object-src 'none';font-src 'self';style-src 'self' 'unsafe-inline' blob:;img-src * data:;base-uri 'self';connect-src 'self' grafana.com ws://$ROOT_PATH wss://$ROOT_PATH;manifest-src 'self';media-src 'none';form-action 'self';"""
```

### Enable trusted types

**Currently in development. [Trusted types](https://github.com/w3c/trusted-types/blob/main/explainer.md) is an experimental Javascript API with [limited browser support](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/trusted-types#browser_compatibility).**

Trusted types reduce the risk of DOM XSS by enforcing developers to sanitize strings that are used in injection sinks, such as setting `innerHTML` on an element. Furthermore, when enabling trusted types, these injection sinks need to go through a policy that will sanitize, or leave the string intact and return it as "safe". This provides some protection from client side injection vulnerabilities in third party libraries, such as jQuery, Angular and even third party plugins.

To enable trusted types:

1. Enable the `trustedTypes` feature toggle.
2. Enable `content_security_policy` in the configuration.
3. Add `require-trusted-types-for 'script'` to the `content_security_policy_template` in the configuration.

## Additional security hardening

The Grafana server has several built-in security features that you can opt-in to enhance security. This section describes additional techniques you can use to harden security.

### Hide the version number

If set to `true`, the Grafana server hides the running version number for unauthenticated users. Version numbers might reveal if you are running an outdated and vulnerable version of Grafana.

Example:

```toml
# mask the Grafana version number for unauthenticated users
hide_version = true
```

### Enforce domain verification

If set to `true`, the Grafana server redirects requests that have a Host-header value that is mismatched to the actual domain. This might help to mitigate some DNS rebinding attacks.

Example:

```toml
# Redirect to correct domain if host header does not match domain
# Prevents DNS rebinding attacks
enforce_domain = true
```
