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
title: Install Grafana CLI
weight: 100
---

# Install Grafana CLI

You can install the project using one of the following supported methods:

## 1. Download a pre-built binary

Download the latest binary for your platform from the [Releases page](https://github.com/grafana/grafanactl/releases).

Prebuilt binaries are available for a variety of operating systems and architectures. Visit the latest release page, and scroll down to the Assets section.

To install the binary, follow the instructions below:

1. Download the archive for the desired operating system and architecture
1. Extract the archive
1. Move the executable to the desired directory
1. Ensure this directory is included in the PATH environment variable
1. Verify that you have execute permission on the file

## 2. Build from source

To build `grafanactl` from source you must:

- Have `git` installed
- Have `go` v1.24 (or greater) installed

```bash
go install github.com/grafana/grafanactl/cmd@latest
```
