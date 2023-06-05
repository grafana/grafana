---
title: Use the create-plugin tool
description: How to get started with the create-plugin tool for Grafana plugin development.
---

# Use the create-plugin tool

Grafana's plugin tools offer an officially supported way to extend Grafana's core functionality. We have designed these tools to help you to develop your plugins faster with a modern build setup and zero configuration.

The plugin tools consist of two packages:

- `create-plugin`: A CLI to scaffold new plugins or migrate plugins created with `@grafana/toolkit`.
- `sign-plugin`: A CLI to sign plugins for distribution.

## Quick Start

To scaffold your plugin, run the command for your preferred package manager and follow the prompts:

**npm:**

`npx @grafana/create-plugin@latest`

**pnmp:**

`pnpm dlx @grafana/create-plugin@latest`

**yarn:**

`yarn create @grafana/plugin`

For next steps, see [Creating a plugin](./creating-a-plugin.mdx)

{{% admonition type="note" %}} If you have previously built a plugin with `@grafana/toolkit`, you can use our plugin tools to simplify migration. For more information, refer to the [Migration guide](./migrating-from-toolkit). {{%
/admonition %}}

### Before you begin

Make sure you are using supported a supported OS, Grafana version, and tooling.

#### Supported operating systems

- [Go](https://go.dev/doc/install) version 1.18 or above
- [Mage](https://magefile.org/)
- [Node.js](https://nodejs.org/en/download/) version 16 or above:
- Optionally [Yarn 1](https://classic.yarnpkg.com/lang/en/docs/install) or [PNPM](https://pnpm.io/installation)
- [Docker](https://docs.docker.com/get-docker/)

Grafana plugin tools work with the following operating systems:

- Linux
- macOS
- Windows 10+ with WSL (Windows Subsystem for Linux)

#### Supported Grafana version

We generally recommend that you build for a version of Grafana later than v9.0. For more information about requirements and dependencies when developing with Grafana, see the [Grafana developer's guide](https://github.com/grafana/grafana/blob/main/contribute/developer-guide.md).

#### Recommended tooling

You'll need to have the following tools set up:

- [Go](https://go.dev/doc/install) version 1.18 or later.
- [Mage](https://magefile.org/).
- [Node.js](https://nodejs.org/en/download/) version 16 or later.
  - We recommend that you should install Node.js with all checkboxes related to dependencies checked.
- [Docker](https://docs.docker.com/get-docker/).
- Optional: [Yarn 1 (Classic)](https://classic.yarnpkg.com/lang/en/docs/install) or [pnpm](https://pnpm.io/installation).

#### Choose a package manager

When you first run `@grafana/create-plugin`, choose your package manager: `npm`, `pnpm`, or `yarn`.

## Output

Run the above command to create a directory called `<orgName>-<pluginName>-<pluginType>` inside the current directory. This directory contains the initial project structure to kickstart your plugin development.

:::info

The directory name `<orgName>-<pluginName>-<pluginType>` is based on the answers you gave to the prompts. Use the name of the generated folder when prompted.

:::

Depending on the answers you gave to the prompts, there should now be a structure like:

```
<orgName>-<pluginName>-<pluginType>
├── .config/
├── .eslintrc
├── .github
│   └── workflows
├── .gitignore
├── .nvmrc
├── .prettierrc.js
├── CHANGELOG.md
├── LICENSE
├── Magefile.go
├── README.md
├── cypress
│   └── integration
├── docker-compose.yaml
├── go.mod
├── go.sum
├── jest-setup.js
├── jest.config.js
├── node_modules
├── package.json
├── pkg
│   ├── main.go
│   └── plugin
├── src
│   ├── README.md
│   ├── components
│   ├── datasource.ts
│   ├── img
│   ├── module.ts
│   ├── plugin.json
│   └── types.ts
└── tsconfig.json
```

When you've finished installing the tools, open the plugin folder:

<CodeSnippets
  paths={[
    'createplugin-install.npm.shell.md',
    'createplugin-install.pnpm.shell.md',
    'createplugin-install.yarn.shell.md',
  ]}
  groupId="package-manager"
  queryString="current-package-manager"
/>

## Key CLI commands

After `create-plugin` has finished, you can run built-in commands in the shell:

### <SyncCommand cmd="run dev" />

Builds the plugin in _development mode_ and runs in _watch mode_. Rebuilds the plugin whenever you make changes to the code. You'll see build errors and lint warnings in the console.

### <SyncCommand cmd="run test" />

Runs the tests and watches for changes.

### <SyncCommand cmd="run build" />

Creates a production build of the plugin that optimizes for the best performance. Minifies the build and includes hashes in the filenames.

`mage -v`

Builds backend plugin binaries for Linux, Windows and Darwin.
