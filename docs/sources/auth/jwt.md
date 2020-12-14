+++
title = "JWT Authentication"
description = "Grafana JWT Authentication"
keywords = ["grafana", "configuration", "documentation", "jwt"]
aliases = ["/docs/grafana/latest/installation/jwt/"]
weight = 300
+++

# JWT Authentication

You can configure Grafana to accept a JWT token provided in the HTTP header. The token is verified using a public key(s) stored in a file or provided by the JWKS endpoint.
You can specify some of the JSON fields embedded in JWT (called claims) to use either as a login or as an email to sign in.

```bash
[auth.jwt]
# 1. Required settings.

# By default, auth.jwt is disabled.
enabled = true

# HTTP header to look into to get a JWT token.
header = X-JWT-Header

# 2. Sign-in claim.

# Use this claim value as a login to sign in 
login_claim = sub

# Use this claim value as an email to sign in 
email_claim = sub

# 3. Verification methods.

# Different methods supported to obtain a public key(s) used for verification:
# Verify token using a JSON Web Key Set loaded from http endpoint
jwk_set_url = https://your-auth-provider.example.com/.well-known/jwks.json
# Verify token using a JSON Web Key Set loaded from file
jwk_set_file = /path/to/file.json
# Verify token using a pem-encoded key file
key_file = /path/to/file.pem

# Cache TTL for data loaded from http endpoint (in minutes)
cache_ttl = 60

# 4. Claim expectations

# You can set up an expectation object to validate JWT claims.
# This can be seen as a required "subset" of JWT claims.
expect_claims = {"iss": "https://your-token-issuer", "your-custom-claim": "foo"}
```
