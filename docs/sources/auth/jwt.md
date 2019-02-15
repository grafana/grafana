+++
title = "JWT Auth"
description = "Grafana OAuthentication Guide "
keywords = ["grafana", "configuration", "documentation", "jwt"]
type = "docs"
[menu.docs]
name = "JWT"
identifier = "jwt_auth"
parent = "authentication"
weight = 6
+++

# JWT Authentication

JSON Web Tokens are an open, industry standard RFC 7519 method for representing claims securely between two parties.

Grafana can use JWT tokens for authentication



```bash
[auth.jwt]
enabled = false
header = X-Your-JWT-Header

# Verification key locator.  This config value can be either:
# 1. URL: ie https://www.gstatic.com/iap/verify/public_key-jwk
# 2. File: ie /var/lib/grafana/yourkeyfile
# 3. String: directly set the key
# The content will be checked for:
# 1. Keys within a JSON structure
# 2. RSA Public Key PEM
# 3. Base64 encoded bytes
# 4. raw key bytes
verification = {url | path to file | string}

# Time before reloading the verification file.
# https://golang.org/pkg/time/#ParseDuration
verification_ttl = 6h

# Claims that need to match the header.  JSON or key:value
expect_claims =

# Check for the login name at this claim
login_claim =

# Check for an email address at this claim
email_claim = email

# Create users when JWT is valid and a user does not match
auto_signup = true
```

## Sample Configurations

### Firebase

```bash
[auth.jwt]
enabled = true
header = X-Your-JWT-Header
verification = https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com
verification_ttl = 6h
expect_claims = iss:https://securetoken.google.com/{your_project}
email_claim = email
auto_signup = true
```


### Google IAP

See https://cloud.google.com/iap/docs/signed-headers-howto for more details.

```bash
[auth.jwt]
enabled = true
header = X-Goog-Authenticated-User-JWT
verification = https://www.gstatic.com/iap/verify/public_key-jwk
verification_ttl = 6h
expect_claims = {\
  "aud": "/projects/PROJECT_NUMBER/global/backendServices/SERVICE_ID", \
  "iss": "https://cloud.google.com/iap" }
email_claim = email
auto_signup = true
```

