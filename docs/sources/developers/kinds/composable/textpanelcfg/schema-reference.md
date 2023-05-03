---
keywords:
  - grafana
  - schema
title: TextPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## TextPanelCfg

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property       | Type                    | Required | Default     | Description                                                                                             |
|----------------|-------------------------|----------|-------------|---------------------------------------------------------------------------------------------------------|
| `CodeLanguage` | string                  | **Yes**  | `plaintext` | Possible values are: `plaintext`, `yaml`, `xml`, `typescript`, `sql`, `go`, `markdown`, `html`, `json`. |
| `CodeOptions`  | [object](#codeoptions)  | **Yes**  |             |                                                                                                         |
| `PanelOptions` | [object](#paneloptions) | **Yes**  |             |                                                                                                         |
| `TextMode`     | string                  | **Yes**  |             | Possible values are: `html`, `markdown`, `code`.                                                        |

### CodeOptions

| Property          | Type    | Required | Default     | Description                                                                                             |
|-------------------|---------|----------|-------------|---------------------------------------------------------------------------------------------------------|
| `language`        | string  | **Yes**  | `plaintext` | Possible values are: `plaintext`, `yaml`, `xml`, `typescript`, `sql`, `go`, `markdown`, `html`, `json`. |
| `showLineNumbers` | boolean | **Yes**  | `false`     |                                                                                                         |
| `showMiniMap`     | boolean | **Yes**  | `false`     |                                                                                                         |

### PanelOptions

| Property  | Type                        | Required | Default                                                                        | Description                                      |
|-----------|-----------------------------|----------|--------------------------------------------------------------------------------|--------------------------------------------------|
| `content` | string                      | **Yes**  | `# Title                                                                       |                                                  |
|           |                             |          |                                                                                |                                                  |
|           |                             |          | For markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)` |                                                  |
| `mode`    | string                      | **Yes**  |                                                                                | Possible values are: `html`, `markdown`, `code`. |
| `code`    | [CodeOptions](#codeoptions) | No       |                                                                                |                                                  |


