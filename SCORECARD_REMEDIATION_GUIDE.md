# Scorecard Remediation Guide

For each finding surfaced in the Plugin Scorecard, this guide links to the authoritative fix reference. CWE links provide conceptual background; the fix reference is the actionable resource.

---

## OpenSSF Scorecard

Full check documentation: [ossf/scorecard — checks.md](https://github.com/ossf/scorecard/blob/main/docs/checks.md)

| Check               | CWE                                                          | Fix Reference                                                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Binary-Artifacts    | [CWE-506](https://cwe.mitre.org/data/definitions/506.html)   | [docs](https://github.com/ossf/scorecard/blob/main/docs/checks.md#binary-artifacts)                                                                                                                                                        |
| Dangerous-Workflow  | [CWE-94](https://cwe.mitre.org/data/definitions/94.html)     | [docs](https://github.com/ossf/scorecard/blob/main/docs/checks.md#dangerous-workflow)                                                                                                                                                      |
| Token-Permissions   | [CWE-732](https://cwe.mitre.org/data/definitions/732.html)   | [docs](https://github.com/ossf/scorecard/blob/main/docs/checks.md#token-permissions)                                                                                                                                                       |
| Pinned-Dependencies | [CWE-829](https://cwe.mitre.org/data/definitions/829.html)   | [docs](https://github.com/ossf/scorecard/blob/main/docs/checks.md#pinned-dependencies)                                                                                                                                                     |
| Signed-Releases     | [CWE-347](https://cwe.mitre.org/data/definitions/347.html)   | [docs](https://github.com/ossf/scorecard/blob/main/docs/checks.md#signed-releases) · [grafana/plugin-actions attestation](https://github.com/grafana/plugin-actions/tree/main/build-plugin#attestation)                                    |
| Vulnerabilities     | [CWE-1329](https://cwe.mitre.org/data/definitions/1329.html) | [docs](https://github.com/ossf/scorecard/blob/main/docs/checks.md#vulnerabilities) · [OSV database](https://osv.dev)                                                                                                                       |
| Code-Review         | [CWE-1357](https://cwe.mitre.org/data/definitions/1357.html) | [docs](https://github.com/ossf/scorecard/blob/main/docs/checks.md#code-review)                                                                                                                                                             |
| Branch-Protection   | [CWE-1026](https://cwe.mitre.org/data/definitions/1026.html) | [docs](https://github.com/ossf/scorecard/blob/main/docs/checks.md#branch-protection)                                                                                                                                                       |
| SAST                | [CWE-358](https://cwe.mitre.org/data/definitions/358.html)   | [docs](https://github.com/ossf/scorecard/blob/main/docs/checks.md#sast) · [CodeQL setup](https://docs.github.com/en/code-security/code-scanning/creating-an-advanced-setup-for-code-scanning/configuring-advanced-setup-for-code-scanning) |
| Security-Policy     | [CWE-693](https://cwe.mitre.org/data/definitions/693.html)   | [docs](https://github.com/ossf/scorecard/blob/main/docs/checks.md#security-policy) · [GitHub security policy](https://docs.github.com/en/code-security/getting-started/adding-a-security-policy-to-your-repository)                        |
| CII-Best-Practices  | [CWE-1059](https://cwe.mitre.org/data/definitions/1059.html) | [docs](https://github.com/ossf/scorecard/blob/main/docs/checks.md#cii-best-practices) · [bestpractices.dev](https://www.bestpractices.dev/en)                                                                                              |
| License             | [CWE-1076](https://cwe.mitre.org/data/definitions/1076.html) | [docs](https://github.com/ossf/scorecard/blob/main/docs/checks.md#license)                                                                                                                                                                 |
| Maintained          | [CWE-1104](https://cwe.mitre.org/data/definitions/1104.html) | [docs](https://github.com/ossf/scorecard/blob/main/docs/checks.md#maintained)                                                                                                                                                              |

---

## JS/TS — eslint-plugin-security

Full rule list: [eslint-community/eslint-plugin-security](https://github.com/eslint-community/eslint-plugin-security#rules)

| Rule                           | CWE                                                        | Fix Reference                                                                                                                  |
| ------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| detect-eval-with-expression    | [CWE-95](https://cwe.mitre.org/data/definitions/95.html)   | [rule docs](https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-eval-with-expression.md)    |
| detect-child-process           | [CWE-78](https://cwe.mitre.org/data/definitions/78.html)   | [rule docs](https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-child-process.md)           |
| detect-non-literal-fs-filename | [CWE-22](https://cwe.mitre.org/data/definitions/22.html)   | [rule docs](https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-non-literal-fs-filename.md) |
| detect-non-literal-require     | [CWE-94](https://cwe.mitre.org/data/definitions/94.html)   | [rule docs](https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-non-literal-require.md)     |
| detect-unsafe-regex            | [CWE-400](https://cwe.mitre.org/data/definitions/400.html) | [rule docs](https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-unsafe-regex.md)            |
| detect-buffer-noassert         | [CWE-119](https://cwe.mitre.org/data/definitions/119.html) | [rule docs](https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-buffer-noassert.md)         |
| detect-pseudoRandomBytes       | [CWE-330](https://cwe.mitre.org/data/definitions/330.html) | [rule docs](https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-pseudoRandomBytes.md)       |
| detect-possible-timing-attacks | [CWE-208](https://cwe.mitre.org/data/definitions/208.html) | [rule docs](https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-possible-timing-attacks.md) |
| detect-object-injection        | [CWE-94](https://cwe.mitre.org/data/definitions/94.html)   | [rule docs](https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-object-injection.md)        |
| detect-bidi-characters         | [CWE-838](https://cwe.mitre.org/data/definitions/838.html) | [rule docs](https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-bidi-characters.md)         |
| detect-non-literal-regexp      | [CWE-400](https://cwe.mitre.org/data/definitions/400.html) | [rule docs](https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-non-literal-regexp.md)      |
| detect-disable-mustache-escape | [CWE-116](https://cwe.mitre.org/data/definitions/116.html) | [rule docs](https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-disable-mustache-escape.md) |

## JS/TS — ESLint core rules

| Rule            | CWE                                                      | Fix Reference                                                      |
| --------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| no-new-func     | [CWE-95](https://cwe.mitre.org/data/definitions/95.html) | [eslint.org](https://eslint.org/docs/latest/rules/no-new-func)     |
| no-implied-eval | [CWE-95](https://cwe.mitre.org/data/definitions/95.html) | [eslint.org](https://eslint.org/docs/latest/rules/no-implied-eval) |
| no-script-url   | [CWE-79](https://cwe.mitre.org/data/definitions/79.html) | [eslint.org](https://eslint.org/docs/latest/rules/no-script-url)   |

## JS/TS — @microsoft/eslint-plugin-sdl

Full rule list: [microsoft/eslint-plugin-sdl](https://github.com/microsoft/eslint-plugin-sdl#rules)

| Rule                       | CWE                                                        | Fix Reference                                                                                                  |
| -------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| no-inner-html              | [CWE-79](https://cwe.mitre.org/data/definitions/79.html)   | [rule docs](https://github.com/microsoft/eslint-plugin-sdl/blob/main/docs/rules/no-inner-html.md)              |
| no-document-write          | [CWE-79](https://cwe.mitre.org/data/definitions/79.html)   | [rule docs](https://github.com/microsoft/eslint-plugin-sdl/blob/main/docs/rules/no-document-write.md)          |
| no-postmessage-star-origin | [CWE-346](https://cwe.mitre.org/data/definitions/346.html) | [rule docs](https://github.com/microsoft/eslint-plugin-sdl/blob/main/docs/rules/no-postmessage-star-origin.md) |
| no-insecure-url            | [CWE-319](https://cwe.mitre.org/data/definitions/319.html) | [rule docs](https://github.com/microsoft/eslint-plugin-sdl/blob/main/docs/rules/no-insecure-url.md)            |

---

## Go — gosec

Full rule list: [securego/gosec — Available Rules](https://github.com/securego/gosec#available-rules)  
General Go security guidance: [go.dev/doc/security/best-practices](https://go.dev/doc/security/best-practices)

| Rule                              | CWE                                                        | Fix Reference                                                                    |
| --------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| G101 — hardcoded credentials      | [CWE-798](https://cwe.mitre.org/data/definitions/798.html) | [gosec rules](https://github.com/securego/gosec#available-rules)                 |
| G102 — bind to all interfaces     | [CWE-200](https://cwe.mitre.org/data/definitions/200.html) | [gosec rules](https://github.com/securego/gosec#available-rules)                 |
| G103 — use of unsafe package      | [CWE-242](https://cwe.mitre.org/data/definitions/242.html) | [gosec rules](https://github.com/securego/gosec#available-rules)                 |
| G107 — SSRF via variable URL      | [CWE-88](https://cwe.mitre.org/data/definitions/88.html)   | [gosec rules](https://github.com/securego/gosec#available-rules)                 |
| G201/G202 — SQL injection         | [CWE-89](https://cwe.mitre.org/data/definitions/89.html)   | [gosec rules](https://github.com/securego/gosec#available-rules)                 |
| G203 — unescaped HTML template    | [CWE-79](https://cwe.mitre.org/data/definitions/79.html)   | [gosec rules](https://github.com/securego/gosec#available-rules)                 |
| G204 — OS command injection       | [CWE-78](https://cwe.mitre.org/data/definitions/78.html)   | [gosec rules](https://github.com/securego/gosec#available-rules)                 |
| G301/G302/G306 — file permissions | [CWE-276](https://cwe.mitre.org/data/definitions/276.html) | [gosec rules](https://github.com/securego/gosec#available-rules)                 |
| G303 — predictable temp file      | [CWE-377](https://cwe.mitre.org/data/definitions/377.html) | [gosec rules](https://github.com/securego/gosec#available-rules)                 |
| G304/G305 — path traversal        | [CWE-22](https://cwe.mitre.org/data/definitions/22.html)   | [gosec rules](https://github.com/securego/gosec#available-rules)                 |
| G401/G501 — weak MD5              | [CWE-327](https://cwe.mitre.org/data/definitions/327.html) | [go.dev crypto](https://pkg.go.dev/crypto)                                       |
| G402 — insecure TLS               | [CWE-295](https://cwe.mitre.org/data/definitions/295.html) | [go.dev/doc/security/best-practices](https://go.dev/doc/security/best-practices) |
| G403 — RSA key too short          | [CWE-310](https://cwe.mitre.org/data/definitions/310.html) | [gosec rules](https://github.com/securego/gosec#available-rules)                 |
| G404 — weak random (math/rand)    | [CWE-338](https://cwe.mitre.org/data/definitions/338.html) | [go.dev crypto/rand](https://pkg.go.dev/crypto/rand)                             |
| G502/G503/G505 — weak ciphers     | [CWE-327](https://cwe.mitre.org/data/definitions/327.html) | [go.dev crypto](https://pkg.go.dev/crypto)                                       |
| G104 — unchecked error            | [CWE-391](https://cwe.mitre.org/data/definitions/391.html) | [gosec rules](https://github.com/securego/gosec#available-rules)                 |
| G106 — ssh InsecureIgnoreHostKey  | [CWE-322](https://cwe.mitre.org/data/definitions/322.html) | [go.dev/x/crypto/ssh](https://pkg.go.dev/golang.org/x/crypto/ssh)                |
| G108 — pprof exposed              | [CWE-200](https://cwe.mitre.org/data/definitions/200.html) | [gosec rules](https://github.com/securego/gosec#available-rules)                 |
| G110 — decompression bomb         | [CWE-409](https://cwe.mitre.org/data/definitions/409.html) | [gosec rules](https://github.com/securego/gosec#available-rules)                 |
| G112/G118/G120 — missing timeouts | [CWE-400](https://cwe.mitre.org/data/definitions/400.html) | [go.dev/doc/security/best-practices](https://go.dev/doc/security/best-practices) |
| G115 — uint to int overflow       | [CWE-190](https://cwe.mitre.org/data/definitions/190.html) | [gosec rules](https://github.com/securego/gosec#available-rules)                 |
| G116 — bidirectional Unicode      | [CWE-838](https://cwe.mitre.org/data/definitions/838.html) | [gosec rules](https://github.com/securego/gosec#available-rules)                 |
