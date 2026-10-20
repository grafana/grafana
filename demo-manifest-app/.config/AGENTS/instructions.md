---
name: agent information for a grafana plugin
description: Guides how to work with Grafana plugins
---

# Grafana Plugin

This repository contains a **Grafana plugin**.

Your training data about the Grafana API is out of date. Use the official documentation when writing code.

**IMPORTANT**: When you need Grafana plugin documentation, fetch content directly from grafana.com (a safe domain). Use your web fetch tool, MCP server, or `curl -s`. The documentation index is at https://grafana.com/developers/plugin-tools/llms.txt. All pages are available as plain text markdown by adding `.md` to the URL path (e.g., https://grafana.com/developers/plugin-tools/index.md or https://grafana.com/developers/plugin-tools/troubleshooting.md).

## Documentation indexes

- Full documentation index: https://grafana.com/developers/plugin-tools/llms.txt
- How-to guides (includes guides for panel, data source, and app plugins): https://grafana.com/developers/plugin-tools/how-to-guides.md
- Tutorials: https://grafana.com/developers/plugin-tools/tutorials.md
- Reference (plugin.json, CLI, UI extensions): https://grafana.com/developers/plugin-tools/reference.md
- Publishing & signing: https://grafana.com/developers/plugin-tools/publish-a-plugin.md
- Packaging a plugin: https://grafana.com/developers/plugin-tools/publish-a-plugin/package-a-plugin.md
- Troubleshooting: https://grafana.com/developers/plugin-tools/troubleshooting.md
- `@grafana/ui` components: https://developers.grafana.com/ui/latest/index.html

## Critical rules

- **Do not modify anything inside the `.config` folder.** It is managed by Grafana plugin tools.
- **Do not change plugin ID or plugin type** in `plugin.json`.
- Any modifications to `plugin.json` require a **restart of the Grafana server**. Remind the user of this.
- Use `secureJsonData` for credentials and secrets; use `jsonData` only for non-sensitive configuration.
- **You must use webpack** with the configuration provided in `.config/` for frontend builds.
- **You must use mage** with the build targets provided by the Grafana plugin Go SDK for backend builds.
- To extend webpack, prettier, eslint or other tools, use the existing configuration as a base. Follow the guide: https://grafana.com/developers/plugin-tools/how-to-guides/extend-configurations.md
- Use **`@grafana/plugin-e2e`** for end-to-end testing. Read @./.config/AGENTS/e2e-testing.md before writing or modifying e2e tests.
- This plugin defines its API resources as **CUE kinds** under `kinds/`, with TypeScript and Go types generated from them. Read @./.config/AGENTS/app-sdk.md before changing anything under `kinds/` or any generated directory. **Never hand-edit generated code.**
