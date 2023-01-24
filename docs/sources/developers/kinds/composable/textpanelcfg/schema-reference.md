---
keywords:
  - grafana
  - schema
title: TextPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# TextPanelCfg kind

### Maturity: experimental
### Version: 0.0

## Properties

| Property       | Type                    | Required | Description                                                                                                                   |
|----------------|-------------------------|----------|-------------------------------------------------------------------------------------------------------------------------------|
| `CodeLanguage` | string                  | **Yes**  | Possible values are: `plaintext`, `yaml`, `xml`, `typescript`, `sql`, `go`, `markdown`, `html`, `json`. Default: `plaintext`. |
| `CodeOptions`  | [object](#codeoptions)  | **Yes**  |                                                                                                                               |
| `PanelOptions` | [object](#paneloptions) | **Yes**  |                                                                                                                               |
| `TextMode`     | string                  | **Yes**  | Possible values are: `html`, `markdown`, `code`.                                                                              |

## CodeOptions

### Properties

| Property          | Type    | Required | Description                                                                                                                   |
|-------------------|---------|----------|-------------------------------------------------------------------------------------------------------------------------------|
| `language`        | string  | **Yes**  | Possible values are: `plaintext`, `yaml`, `xml`, `typescript`, `sql`, `go`, `markdown`, `html`, `json`. Default: `plaintext`. |
| `showLineNumbers` | boolean | **Yes**  | Default: `false`.                                                                                                             |
| `showMiniMap`     | boolean | **Yes**  | Default: `false`.                                                                                                             |

## PanelOptions

### Properties

| Property  | Type                        | Required | Description                                                                                                |
|-----------|-----------------------------|----------|------------------------------------------------------------------------------------------------------------|
| `content` | string                      | **Yes**  | Default: `# Title<br/><br/>For markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)`. |
| `mode`    | string                      | **Yes**  | Possible values are: `html`, `markdown`, `code`.                                                           |
| `code`    | [CodeOptions](#codeoptions) | No       |                                                                                                            |

### CodeOptions

#### Properties

| Property          | Type    | Required | Description                                                                                                                   |
|-------------------|---------|----------|-------------------------------------------------------------------------------------------------------------------------------|
| `language`        | string  | **Yes**  | Possible values are: `plaintext`, `yaml`, `xml`, `typescript`, `sql`, `go`, `markdown`, `html`, `json`. Default: `plaintext`. |
| `showLineNumbers` | boolean | **Yes**  | Default: `false`.                                                                                                             |
| `showMiniMap`     | boolean | **Yes**  | Default: `false`.                                                                                                             |


