# Plugin Scoring

Grafana plugins vary widely in quality, security hygiene, and community trust. To help users make informed decisions at the point of installation, we score plugins across three dimensions that together give a holistic picture of a plugin's health — not just its security posture.

The three dimensions are:

| Dimension     | Question it answers                      |
| ------------- | ---------------------------------------- |
| **Safety**    | Is this safe to run?                     |
| **Quality**   | Is this well-built?                      |
| **Community** | Is this well supported by its community? |

Each dimension produces a score and a list of findings. A finding identifies a specific concern, its severity, and a reference to the authoritative standard that defines it.

---

## Why CWE?

Findings are identified using the [Common Weakness Enumeration (CWE)](https://cwe.mitre.org/) standard, maintained by MITRE. CWE is:

- **Language and tool agnostic** — the same weakness ID means the same thing whether it was detected by a Go static analyser, a JavaScript linter, or a supply chain scanner
- **Free for commercial use** — explicitly permitted for any research, development, or commercial purpose under the [CWE Terms of Use](https://cwe.mitre.org/about/termsofuse.html)
- **Industry standard** — referenced by CVEs, OWASP, NIST, and every major SAST tool
- **Stable** — weakness IDs don't change, so findings remain meaningful as the underlying scanning tools evolve

Each finding in the scoring API takes the form:

```json
{
  "id": "CWE-95",
  "reference": "https://cwe.mitre.org/data/definitions/95.html",
  "level": "high"
}
```

The `id` is the stable machine-readable identifier. The `reference` is the canonical CWE documentation URL, always derivable as `https://cwe.mitre.org/data/definitions/<number>.html`.

---

## API Schema

The plugin scoring endpoint (`GET /api/gnet/plugins/:pluginId/versions/:version/insights`) returns data using the existing `CatalogPluginInsights` shape, so our data is rendered by the existing `PluginInsights` frontend component without additional frontend changes.

```json
{
  "id": 0,
  "name": "grafana-azure-monitor-datasource",
  "version": "13.1.0-pre",
  "insights": [
    {
      "name": "safety",
      "scoreValue": 62.5,
      "scoreLevel": "Poor",
      "items": [
        {
          "id": "CWE-347",
          "name": "Signed-Releases",
          "level": "warning",
          "link": "https://cwe.mitre.org/data/definitions/347.html"
        }
      ]
    },
    {
      "name": "quality",
      "scoreValue": 75.0,
      "scoreLevel": "Good",
      "items": [
        {
          "id": "CWE-1059",
          "name": "CII-Best-Practices",
          "level": "warning",
          "link": "https://cwe.mitre.org/data/definitions/1059.html"
        }
      ]
    },
    {
      "name": "community",
      "scoreValue": 100.0,
      "scoreLevel": "Excellent",
      "items": []
    }
  ]
}
```

### Field reference

| Field                   | Type   | Description                                                               |
| ----------------------- | ------ | ------------------------------------------------------------------------- |
| `name`                  | string | Plugin slug                                                               |
| `version`               | string | Plugin version this score applies to                                      |
| `insights`              | array  | One entry per dimension; always contains `safety`, `quality`, `community` |
| `insights[].name`       | string | Dimension identifier: `safety`, `quality`, or `community`                 |
| `insights[].scoreValue` | float  | Grafana-computed dimension score, 0–100                                   |
| `insights[].scoreLevel` | string | Human label: `Excellent`, `Good`, `Fair`, `Poor`, or `Critical`           |
| `insights[].items`      | array  | Failing checks for this dimension; empty array if none                    |
| `items[].id`            | string | CWE identifier (e.g. `CWE-95`), or `NVD-CWE-noinfo` if not yet classified |
| `items[].name`          | string | Scorecard check name (e.g. `Signed-Releases`, `Branch-Protection`)        |
| `items[].level`         | string | `"good"` if passing, `"warning"` if failing                               |
| `items[].link`          | string | Canonical CWE documentation URL                                           |

### Design principles

- **Scores are Grafana-owned.** `scoreValue` and `scoreLevel` are computed by Grafana's weighting logic — not passed through from any single scanning tool.
- **Items use CWE IDs.** `items[].id` is the stable machine-readable identifier; `items[].name` is the human-readable check name for display. Consumers should not infer which tool produced a finding from the name alone.
- **Dimensions are always present.** A dimension with no failing checks returns `"items": []`. Consumers can rely on all three dimension names being present in every response.
- **Cache key is `pluginId@version`.** Scores are cached per plugin version. An upgrade automatically triggers a fresh scan on the next request.
- **Unmapped findings use `NVD-CWE-noinfo`.** If a scanner produces a finding not yet mapped to a specific CWE, `id` is set to `"NVD-CWE-noinfo"` with `link` pointing to `https://nvd.nist.gov/vuln/categories#cweIdEntry-NVD-CWE-noinfo`.

---

## Dimensions

### Safety — _"Is this safe to run?"_

Covers known vulnerabilities in dependencies, dangerous code patterns in plugin source, and supply chain hygiene in the CI/CD pipeline.

#### OpenSSF Scorecard

| CWE      | Check               | Risk     | Summary                                                                       |
| -------- | ------------------- | -------- | ----------------------------------------------------------------------------- |
| CWE-1329 | Vulnerabilities     | High     | One or more unfixed CVEs found in project dependencies                        |
| CWE-506  | Binary-Artifacts    | High     | Pre-built binaries in source cannot be code-reviewed                          |
| CWE-94   | Dangerous-Workflow  | Critical | Pull request workflows allow untrusted code to execute with write permissions |
| CWE-732  | Token-Permissions   | High     | Overly broad CI token permissions enable supply chain injection               |
| CWE-829  | Pinned-Dependencies | Medium   | Mutable `@v3`-style tags can be silently replaced with malicious code         |
| CWE-347  | Signed-Releases     | High     | Unsigned releases cannot be verified as authentic                             |
| CWE-940  | Webhooks            | Critical | Webhook secrets not configured — accessible to unauthenticated third parties  |

#### JS/TS (eslint-plugin-security)

| CWE     | Rule                                  | Summary                                                          |
| ------- | ------------------------------------- | ---------------------------------------------------------------- |
| CWE-95  | detect-eval-with-expression           | `eval(variable)` — arbitrary code execution                      |
| CWE-78  | detect-child-process                  | `child_process` with non-literal `exec()` — OS command injection |
| CWE-22  | detect-non-literal-fs-filename        | `fs` calls with variable filename — path traversal               |
| CWE-94  | detect-non-literal-require            | `require(variable)` — arbitrary module loading                   |
| CWE-400 | detect-unsafe-regex                   | ReDoS-vulnerable regular expressions                             |
| CWE-116 | detect-disable-mustache-escape        | Template escaping disabled — XSS vector                          |
| CWE-352 | detect-no-csrf-before-method-override | CSRF middleware ordered incorrectly                              |
| CWE-330 | detect-pseudoRandomBytes              | Weak random number generation                                    |
| CWE-208 | detect-possible-timing-attacks        | Non-constant-time string comparison — timing oracle              |
| CWE-94  | detect-object-injection               | Prototype pollution via bracket notation                         |
| CWE-838 | detect-bidi-characters                | Unicode bidirectional characters — Trojan Source attack          |
| CWE-119 | detect-buffer-noassert                | `Buffer` with `noAssert` — memory safety bypass                  |
| CWE-400 | detect-non-literal-regexp             | `RegExp(variable)` — ReDoS via user-controlled regex             |

#### Go (gosec)

| CWE     | Rule           | Summary                                                        |
| ------- | -------------- | -------------------------------------------------------------- |
| CWE-798 | G101           | Hardcoded credentials in source                                |
| CWE-88  | G107           | URL from taint input passed to HTTP request (SSRF)             |
| CWE-89  | G201/G202      | SQL query built with format string or string concatenation     |
| CWE-78  | G204/G702      | OS command execution with variable input                       |
| CWE-22  | G304/G305/G703 | File path from taint input — directory traversal               |
| CWE-79  | G203/G705      | Unescaped data in HTML templates — XSS                         |
| CWE-918 | G704           | Server-side request forgery (SSRF)                             |
| CWE-295 | G402/G123      | Insecure TLS configuration or certificate verification skipped |
| CWE-327 | G401/G501–G507 | Use of broken/deprecated cryptographic algorithm               |
| CWE-338 | G404           | Insecure random number source (`math/rand`)                    |
| CWE-310 | G403           | RSA key length below 2048 bits                                 |
| CWE-242 | G103           | Use of `unsafe` package                                        |
| CWE-409 | G110           | Decompression bomb via `io.Copy` without size limit            |
| CWE-499 | G117           | Secrets exposed via JSON/YAML/TOML marshaling                  |
| CWE-276 | G301/G302/G306 | Overly permissive file permissions                             |
| CWE-200 | G102/G108/G119 | Sensitive data exposed via bound interface or pprof endpoint   |
| CWE-400 | G112/G118/G120 | Denial of service via missing timeouts                         |
| CWE-190 | G109/G115      | Integer overflow via type conversion                           |
| CWE-838 | G116           | Trojan Source attack via bidirectional Unicode characters      |

---

### Quality — _"Is this well-built?"_

Covers development practices that indicate the plugin is built with care and correctness: code review, testing, static analysis, licensing, and documentation of security processes.

#### OpenSSF Scorecard

| CWE      | Check                  | Risk   | Summary                                                           |
| -------- | ---------------------- | ------ | ----------------------------------------------------------------- |
| CWE-1357 | Code-Review            | High   | Pull requests merged without review                               |
| CWE-1026 | Branch-Protection      | High   | Main branch not protected against direct pushes                   |
| CWE-358  | SAST                   | Medium | No static analysis tooling configured (e.g. CodeQL)               |
| CWE-1127 | CI-Tests               | Low    | No automated tests running in CI                                  |
| CWE-1164 | Fuzzing                | Medium | No fuzz testing configured                                        |
| CWE-693  | Security-Policy        | Medium | No `SECURITY.md` — no documented vulnerability disclosure process |
| CWE-1059 | CII-Best-Practices     | Low    | No OpenSSF Best Practices badge                                   |
| CWE-1076 | License                | Low    | No license file present                                           |
| CWE-1059 | SBOM                   | Medium | No software bill of materials published                           |
| CWE-1103 | Dependency-Update-Tool | High   | No Dependabot or Renovate configured                              |

---

### Community — _"Is this well supported for its community?"_

Covers signals that indicate how actively a plugin is adopted, maintained, and supported by its community. This includes breadth of contribution, recency of maintenance, responsiveness to issues, documentation quality, download adoption, and bus factor risk. These are not code-level findings but are meaningful signals when choosing between two otherwise comparable plugins.

#### OpenSSF Scorecard

| CWE      | Check        | Risk | Summary                                                         |
| -------- | ------------ | ---- | --------------------------------------------------------------- |
| CWE-1104 | Maintained   | High | No commits in 90+ days — project may be abandoned               |
| CWE-1104 | Contributors | Low  | Contributions from a single organisation — high bus factor risk |

#### Grafana Plugin Catalog (GCOM)

| CWE      | Signal             | Summary                                                      |
| -------- | ------------------ | ------------------------------------------------------------ |
| CWE-1104 | Signature type     | Plugin is unsigned — not reviewed by Grafana                 |
| CWE-1104 | Low download count | Plugin has very few installs — limited real-world validation |
| CWE-1059 | No documentation   | Plugin has no README or linked documentation                 |

---

## Notes

- CWE IDs are assigned to the **category of weakness** the finding represents, not to the specific tool rule. The same CWE may appear across multiple tools if they detect the same class of problem.
- The same finding may be detected by more than one tool (e.g. both gosec and ripgrep can detect hardcoded credentials). Deduplication by CWE ID is recommended before scoring.
- Scorecard risk levels (Critical/High/Medium/Low) are Scorecard's own classification and inform the `level` field in the finding schema, but do not map 1:1.
- **Community** findings do not map cleanly to CWEs designed for code weaknesses. `CWE-1104` (Use of Unmaintained Third Party Components) is the closest applicable standard for abandonment and trust signals.
