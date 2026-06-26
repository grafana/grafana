# ESLint Security Sidecar — Local Setup

A Docker sidecar that runs [eslint-plugin-security](https://github.com/eslint-community/eslint-plugin-security) and [@microsoft/eslint-plugin-sdl](https://github.com/microsoft/eslint-plugin-sdl) against plugin repositories for JS/TS static security analysis.

## Prerequisites

- Docker
- A GitHub personal access token with `public_repo` scope — [create one here](https://github.com/settings/tokens)

> **SSO requirement:** If you're scanning repos under a SAML SSO-enforced GitHub organisation (e.g. `grafana/`), your token must also be SSO-authorized. Visit `https://github.com/settings/tokens`, find your token, and click **Configure SSO → Authorize** for the relevant org.

## Start the sidecar

```bash
export GITHUB_AUTH_TOKEN=ghp_yourtoken
make devenv sources=eslint_sidecar
```

## Configure Grafana

Add to `conf/custom.ini`:

```ini
[plugin_security]
eslint_sidecar_url = http://localhost:8089/cgi-bin/scan.sh
```

## Start Grafana

```bash
make run
```

## Test it

```bash
curl "http://localhost:8089/cgi-bin/scan.sh?repo=github.com/grafana/clock-panel"
```

Returns a JSON array of ESLint findings per file. Each file entry includes:

- `messages` — active findings (errors and warnings)
- `suppressedMessages` — findings silenced by inline `eslint-disable` comments in the source

Plugins with no `src/` directory return:

```json
{ "results": [], "message": "no JS/TS source files found in src/" }
```

`make devenv` exits immediately — the sidecar keeps running in the background until `make devenv-down`.

If `GITHUB_AUTH_TOKEN` is missing you'll get an immediate error:

```json
{ "error": "GITHUB_AUTH_TOKEN is not set. Start the container with -e GITHUB_AUTH_TOKEN=<token>" }
```

## Rules

### eslint-plugin-security (MIT)

| CWE     | Reference                                               | Rule                             | Severity | Detects                                              |
| ------- | ------------------------------------------------------- | -------------------------------- | -------- | ---------------------------------------------------- |
| CWE-95  | [link](https://cwe.mitre.org/data/definitions/95.html)  | `detect-eval-with-expression`    | error    | `eval(variable)` — arbitrary code execution          |
| CWE-78  | [link](https://cwe.mitre.org/data/definitions/78.html)  | `detect-child-process`           | error    | `child_process` exec with non-literal args           |
| CWE-22  | [link](https://cwe.mitre.org/data/definitions/22.html)  | `detect-non-literal-fs-filename` | error    | `fs` calls with variable path — path traversal       |
| CWE-94  | [link](https://cwe.mitre.org/data/definitions/94.html)  | `detect-non-literal-require`     | error    | `require(variable)` — arbitrary module loading       |
| CWE-400 | [link](https://cwe.mitre.org/data/definitions/400.html) | `detect-unsafe-regex`            | error    | ReDoS-vulnerable regular expressions                 |
| CWE-119 | [link](https://cwe.mitre.org/data/definitions/119.html) | `detect-buffer-noassert`         | error    | `Buffer` with `noAssert` — memory safety bypass      |
| CWE-330 | [link](https://cwe.mitre.org/data/definitions/330.html) | `detect-pseudoRandomBytes`       | error    | Weak random number generation                        |
| CWE-838 | [link](https://cwe.mitre.org/data/definitions/838.html) | `detect-bidi-characters`         | error    | Trojan Source attack via bidirectional Unicode       |
| CWE-400 | [link](https://cwe.mitre.org/data/definitions/400.html) | `detect-non-literal-regexp`      | error    | `RegExp(variable)` — ReDoS via user-controlled regex |
| CWE-116 | [link](https://cwe.mitre.org/data/definitions/116.html) | `detect-disable-mustache-escape` | error    | Template escaping disabled — XSS vector              |
| CWE-208 | [link](https://cwe.mitre.org/data/definitions/208.html) | `detect-possible-timing-attacks` | warn     | Non-constant-time string comparison                  |
| CWE-94  | [link](https://cwe.mitre.org/data/definitions/94.html)  | `detect-object-injection`        | warn     | Prototype pollution via bracket notation             |

### ESLint core (built-in)

| CWE    | Reference                                              | Rule              | Severity | Detects                                     |
| ------ | ------------------------------------------------------ | ----------------- | -------- | ------------------------------------------- |
| CWE-95 | [link](https://cwe.mitre.org/data/definitions/95.html) | `no-new-func`     | error    | `new Function()` — arbitrary code execution |
| CWE-95 | [link](https://cwe.mitre.org/data/definitions/95.html) | `no-implied-eval` | error    | `setTimeout("code")` — eval-equivalent      |
| CWE-79 | [link](https://cwe.mitre.org/data/definitions/79.html) | `no-script-url`   | error    | `javascript:` URLs — XSS via URL injection  |

### @microsoft/eslint-plugin-sdl (MIT)

| CWE     | Reference                                               | Rule                         | Severity | Detects                                               |
| ------- | ------------------------------------------------------- | ---------------------------- | -------- | ----------------------------------------------------- |
| CWE-79  | [link](https://cwe.mitre.org/data/definitions/79.html)  | `no-inner-html`              | error    | `innerHTML =` — unsanitized DOM manipulation          |
| CWE-79  | [link](https://cwe.mitre.org/data/definitions/79.html)  | `no-document-write`          | error    | `document.write()` — XSS vector                       |
| CWE-346 | [link](https://cwe.mitre.org/data/definitions/346.html) | `no-postmessage-star-origin` | error    | `postMessage(data, "*")` — data leakage to any origin |
| CWE-319 | [link](https://cwe.mitre.org/data/definitions/319.html) | `no-insecure-url`            | warn     | Hardcoded `http://` — cleartext transmission          |

## References

- [eslint-plugin-security rules](https://github.com/eslint-community/eslint-plugin-security#rules)
- [Microsoft SDL ESLint plugin](https://github.com/microsoft/eslint-plugin-sdl)
- [CWE MITRE database](https://cwe.mitre.org/data/index.html)
