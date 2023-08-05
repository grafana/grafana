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
				TextMode: "html" | "markdown" | "code" @cuetsy(kind="enum",memberNames="HTML|Markdown|Code")

				CodeLanguage: "json" | "yaml" | "xml" | "typescript" | "sql" | "go" | "markdown" | "html" | *"plaintext" @cuetsy(kind="enum")

				CodeOptions: {
					// The language passed to monaco code editor
					language:        CodeLanguage
					showLineNumbers: bool | *false
					showMiniMap:     bool | *false
				} @cuetsy(kind="interface")

				Options: {
					mode:    TextMode & (*"markdown" | _)
					code?:   CodeOptions
					content: string | *"""
						# Title

						For markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)
						"""
				} @cuetsy(kind="interface")
			}
		}]
		lenses: []
	}
}
