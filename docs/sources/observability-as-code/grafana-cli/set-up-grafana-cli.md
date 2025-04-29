---
_build:
  list: false
noindex: true
cascade:
  noindex: true
description: Configuration guide for Grafana CLI, a command line tool for managing Grafana resources as code.
keywords:
  - configuration
  - Grafana CLI
  - CLI
  - command line
  - grafanactl
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Set up Grafana CLI
weight: 200
---

# Set up Grafana CLI

You can configure Grafana CLI in two ways: using environment variables or through a configuration file.

- **Environment variables** are ideal for CI environments and support a single context.
- **Configuration files** can manage multiple contexts, making it easier to switch between different Grafana instances.

## Use environment variables

Grafana CLI communicates with Grafana via its REST API, which requires authentication credentials.

At a minimum, set the URL of your Grafana instance and the organization ID:

```bash
GRAFANA_SERVER='http://localhost:3000' GRAFANA_ORG_ID='1' grafanactl config check
```

Depending on your authentication method, you may also need to set:

- A [token](https://github.com/grafana/grafanactl/blob/main/docs/reference/environment-variables/index.md#grafana_token) for a [Grafana service account](https://grafana.com/docs/grafana/latest/administration/service-accounts/) (recommended)
- A [username](https://github.com/grafana/grafanactl/blob/main/docs/reference/environment-variables/index.md#grafana_user) and [password](https://github.com/grafana/grafanactl/blob/main/docs/reference/environment-variables/index.md#grafana_password) for basic authentication

To persist your configuration, consider [creating a context](#defining-contexts).

A full list of supported environment variables is available in the [reference documentation](https://github.com/grafana/grafanactl/blob/main/docs/reference/environment-variables/index.md#environment-variables-reference).

## Define contexts

Contexts allow you to easily switch between multiple Grafana instances. By default, the CLI uses a context named `default`.

To configure the `default` context:

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

## Configuration file

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
