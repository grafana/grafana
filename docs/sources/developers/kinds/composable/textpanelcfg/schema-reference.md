---
keywords:
  - grafana
  - schema
title: TextPanelCfg kind
---
> Documentation generation is still in active development and is subject to further improvements.

> Kinds **schema** is also subject to active development, and could change without prior notice.

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


