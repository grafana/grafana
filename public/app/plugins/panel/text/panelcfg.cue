// Copyright 2021 Grafana Labs
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package grafanaplugin

composableKinds: PanelCfg: {
	maturity: "experimental"

	lineage: {
		schemas: [{
			version: [0, 0]
			schema: {
				TextMode: "html" | "markdown" | "code" | "insight" @cuetsy(kind="enum",memberNames="HTML|Markdown|Code|Insight")

				CodeLanguage: "json" | "yaml" | "xml" | "typescript" | "sql" | "go" | "markdown" | "html" | *"plaintext" @cuetsy(kind="enum")

				// Whether the content template renders once, or once per row of query data.
				RenderMode: "once" | "perRow" @cuetsy(kind="enum",memberNames="Once|PerRow")

				CodeOptions: {
					// The language passed to monaco code editor
					language:        CodeLanguage
					showLineNumbers: bool | *false
					showMiniMap:     bool | *false
				} @cuetsy(kind="interface")

				// Insight mode asks Assistant a saved question about the data shown by the selected panels.
				InsightOptions: {
					// The question Assistant answers about the source panels.
					question: string | *""
					// Scene keys of the panels whose loaded data Assistant may use, such as "panel-3".
					// A "section:" prefixed key references every panel in a tab or row.
					sourcePanelKeys: [...string]
					// Questions the viewer can ask after the answer, each answered inside the panel.
					followUps: [...string]
				} @cuetsy(kind="interface")

				Options: {
					mode:        TextMode & (*"markdown" | _)
					renderMode?: RenderMode & (*"once" | _)
					code?:       CodeOptions
					insight?:    InsightOptions
					// Rows per page once a per-row render pages its content. Unset fits the page to the panel height.
					pageSize?: number
					content: string | *"""
						# Title

						For markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)
						"""
					// Index of the selected frame, when the query returns more than one
					frameIndex?: number & (*0 | _)
				} @cuetsy(kind="interface")
			}
		}]
		lenses: []
	}
}
