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

package grafana

import (
	"embed"
)

// CoreSchema embeds all core CUE files, which live in packages/grafana-schema/src
//
//go:embed cue.mod cue packages/grafana-schema/src/schema/*.cue packages/grafana-schema/src/scuemata/*/*.cue packages/grafana-schema/src/scuemata/*/*/*.cue
var CoreSchema embed.FS

// PluginSchema embeds all expected plugin CUE files and plugin metadata from
// within the public/app/plugins subdirectory.
//
//go:embed public/app/plugins/*/*/*.cue public/app/plugins/*/*/plugin.json
var PluginSchema embed.FS
