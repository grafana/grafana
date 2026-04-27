---
description: Installation guide for Grafana CLI, a command line tool for managing Grafana Observability as Code
keywords:
  - configuration
  - Grafana CLI
  - CLI
  - command line
  - grafanactl
  - installation
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Install and set up the grafanactl CLI
menuTitle: grafanactl CLI (deprecated)
weight: 200
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/grafana-cli/install-grafana-cli/
aliases:
  - ../../../observability-as-code/grafana-cli/install-grafana-cli/ # /docs/grafana/next/observability-as-code/grafana-cli/install-grafana-cli/
  - ../../../observability-as-code/grafana-cli/set-up-grafana-cli/ # /docs/grafana/next/observability-as-code/grafana-cli/set-up-grafana-cli/
  - ../../observability-as-code/grafana-cli/set-up-grafana-cli/
  - ../../observability-as-code/grafana-cli/install-grafana-cli/ # /docs/grafana/next/observability-as-code/grafana-cli/install-grafana-cli/
---

# Install and set up the `grafanactl` CLI

{{< admonition type="caution" >}}

`grafanactl` is being deprecated, and we're bringing all our learnings and experience into the new, improved CLI tool [`gcx`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/grafana-cli/gcx). The `grafanactl` repository in GitHub will be archived on June 1, 2026.

To migrate from `grafanactl` to `gcx`, search-and-replace `grafanactl` with `gcx`. For `grafanactl resources serve`, use `gcx dev serve` instead.

{{< /admonition >}}

The `grafanactl` command-line tool allows you to authenticate, manage multiple environments, and perform administrative tasks through the Grafana REST API, all from the terminal. It's available for Grafana OSS, Enterprise, and Cloud.

## Install the Grafana CLI `grafanactl`

You can install the project using one of the following supported methods:

### 1. Download a pre-built binary

Download the latest binary for your platform from the [Releases page](https://github.com/grafana/grafanactl/releases).

Prebuilt binaries are available for a variety of operating systems and architectures. Visit the latest release page, and scroll down to the Assets section.

To install the binary, follow the instructions below:

1. Download the archive for the desired operating system and architecture
1. Extract the archive
1. Move the executable to the desired directory
1. Ensure this directory is included in the PATH environment variable
1. Verify that you have execute permission on the file

### 2. Build from source

To build `grafanactl` from source you must:

- Have `git` installed
- Have `go` v1.24 (or greater) installed

```bash
go install github.com/grafana/grafanactl/cmd/grafanactl@latest
```

## Configure `grafanactl`

You can configure `grafanactl` in two ways: using environment variables or through a configuration file.

- **Environment variables** are ideal for CI environments and support a single context. A full list of supported environment variables is available in the [reference documentation](https://github.com/grafana/grafanactl/blob/main/docs/reference/environment-variables/index.md#environment-variables-reference).
- **Configuration files** can manage multiple contexts, making it easier to switch between different Grafana instances.

{{< admonition type="note" >}}
Configuration items may change depending on your set-up. For example, use `org-id` for self-managed Grafana, but use `stack-id` for Grafana Cloud.
{{< /admonition >}}

### Configure Grafana CLI with environment variables

Grafana CLI communicates with Grafana via the REST API, which requires authentication credentials.

At a minimum, set the URL of your Grafana instance and the organization ID:

```bash
GRAFANA_SERVER='http://localhost:3000' GRAFANA_ORG_ID='1' grafanactl config check
```

Depending on your authentication method, you may also need to set:

- A [token](https://github.com/grafana/grafanactl/blob/main/docs/reference/environment-variables/index.md#grafana_token) for a [Grafana service account](https://grafana.com/docs/grafana/latest/administration/service-accounts/) (recommended)
- A [username](https://github.com/grafana/grafanactl/blob/main/docs/reference/environment-variables/index.md#grafana_user) and [password](https://github.com/grafana/grafanactl/blob/main/docs/reference/environment-variables/index.md#grafana_password) for basic authentication

To persist your configuration, consider [creating a context](#use-configuration-contexts).

#### Use configuration contexts

Contexts allow you to easily switch between multiple Grafana instances.

By default, the CLI uses a context named `default`. To configure it use:

```bash
grafanactl config set contexts.default.grafana.server http://localhost:3000
grafanactl config set contexts.default.grafana.org-id 1

# Authenticate with a service account token
grafanactl config set contexts.default.grafana.token service-account-token

# Or use basic authentication
grafanactl config set contexts.default.grafana.user admin
grafanactl config set contexts.default.grafana.password admin
```

You can define additional contexts in the same way:

```bash
grafanactl config set contexts.staging.grafana.server https://staging.grafana.example
grafanactl config set contexts.staging.grafana.org-id 1
```

{{< admonition type="note" >}}
In these examples, `default` and `staging` are the names of the contexts.
{{< /admonition >}}

### Configure Grafana CLI with configuration files

Grafana CLI stores its configuration in a YAML file. The CLI determines the configuration file location in the following order:

1. If the `--config` flag is provided, the specified file is used.
2. If `$XDG_CONFIG_HOME` is set:
   `$XDG_CONFIG_HOME/grafanactl/config.yaml`
3. If `$HOME` is set:
   `$HOME/.config/grafanactl/config.yaml`
4. If `$XDG_CONFIG_DIRS` is set:
   `$XDG_CONFIG_DIRS/grafanactl/config.yaml`

{{< admonition type="note" >}}
Use `grafanactl config check` to display the configuration file currently in use.
{{< /admonition >}}

## Useful commands

Check the current configuration:

```bash
grafanactl config check
```

{{< admonition type="note" >}}
This command is useful to troubleshoot your configuration.
{{< /admonition >}}

List all available contexts:

```bash
grafanactl config list-contexts
```

Switch to a specific context:

```bash
grafanactl config use-context staging
```

View the full configuration:

```bash
grafanactl config view
```
