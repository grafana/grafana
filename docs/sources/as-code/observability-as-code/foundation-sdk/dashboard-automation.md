---
description: Learn how to automatically generate and deploy Grafana dashboards as code with GitHub Actions.
keywords:
  - foundation SDK
  - dashboard provisioning
  - CI/CD
  - GitHub Actions
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Automate dashboard provisioning with CI/CD
weight: 200
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/foundation-sdk/dashboard-automation/
aliases:
  - ../../../observability-as-code/foundation-sdk/dashboard-automation/ # /docs/grafana/next/observability-as-code/foundation-sdk/dashboard-automation/
---

# Automate dashboard provisioning with CI/CD

Managing Grafana dashboards manually can be inefficient and error-prone. With the Grafana Foundation SDK you can define dashboards using strongly typed code, commit them to version control systems, and automatically deploy them using GitHub Actions.

## Why automate?

Automating Grafana dashboard deployment eliminates the need for manual dashboard creation and updates, ensuring that dashboards remain consistent across environments.

By defending dashboards as code and managing them through CI/CD such as GitHub Actions, you will gain full version control, making it easy to track changes over time and roll back if needed. This also prevents duplication, as the workflow intelligently checks whether a dashboard exists before deciding to create or update it.

With this fully automated CI/CD pipeline, you can focus on improving your dashboards rather than manually uploading JSON files to Grafana.

{{< youtube id="cFnO8kVOaAI" >}}

You can find the full example source code in the [Introduction to the Foundation SDK](https://github.com/grafana/intro-to-foundation-sdk/tree/main/github-actions-example) GitHib repository.

## Overview

This guide shows you how to:

1. Generate a Grafana dashboard as code and format it for Kubernetes-style deployment
2. Use GitHub Actions to deploy, verify, and update the dashboard

By the end, you'll be able to provision your dashboard as code, and every change to your dashboard will be automatically created or updated in your Grafana instance without manual intervention.

## 1. Generate the dashboard JSON

Before deploying a dashboard, [define it as code using the Grafana Foundation SDK](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/foundation-sdk/#create-a-dashboard/).

Since Grafana exposes a Kubernetes resource compatible API, you need to make some changes to the code to output the dashboard JSON in the appropriate format.

This script:

- Generates a Grafana dashboard JSON file
- Wraps it in a Kubernetes-style API format (`apiVersion`, `kind`, `metadata`, `spec`)
- Saves it as `dashboard.json` for deployment

{{< code >}}

```go
package main

import (
	"encoding/json"
	"log"
	"os"

	"github.com/grafana/grafana-foundation-sdk/go/cog"
	"github.com/grafana/grafana-foundation-sdk/go/common"
	"github.com/grafana/grafana-foundation-sdk/go/dashboard"
)

type DashboardWrapper struct {
	APIVersion string              `json:"apiVersion"`
	Kind       string              `json:"kind"`
	Metadata   Metadata            `json:"metadata"`
	Spec       dashboard.Dashboard `json:"spec"`
}

type Metadata struct {
	Name string `json:"name"`
}

func main() {
	builder := dashboard.NewDashboardBuilder("My Dashboard").
		Uid("my-dashboard").
		Tags([]string{"generated", "foundation-sdk", "go"}).
		Refresh("5m").
		Time("now-1h", "now").
		Timezone(common.TimeZoneBrowser).
		WithRow(dashboard.NewRowBuilder("Overview"))

	dashboard, err := builder.Build()
	if err != nil {
		log.Fatalf("failed to build dashboard: %v", err)
	}

	dashboardWrapper := DashboardWrapper{
		APIVersion: "dashboard.grafana.app/v1beta1",
		Kind:       "Dashboard",
		Metadata: Metadata{
			Name: *dashboard.Uid,
		},
		Spec: dashboard,
	}

	dashboardJson, err := json.MarshalIndent(dashboardWrapper, "", "  ")
	if err != nil {
		log.Fatalf("failed to marshal dashboard: %v", err)
	}

	err = os.WriteFile("dashboard.json", dashboardJson, 0644)
	if err != nil {
		log.Fatalf("failed to write dashboard to file: %v", err)
	}

	log.Printf("Dashboard JSON:\n%s", dashboardJson)
}
```

```typescript
import { DashboardBuilder, RowBuilder } from '@grafana/grafana-foundation-sdk/dashboard';
import * as fs from 'fs';

// Generate the dashboard JSON
const dashboard = new DashboardBuilder('My Dashboard')
  .uid('my-dashboard')
  .tags(['generated', 'foundation-sdk', 'typescript'])
  .refresh('5m')
  .time({ from: 'now-1h', to: 'now' })
  .timezone('browser')
  .withRow(new RowBuilder('Overview'))
  .build();

// Convert to Kubernetes-style format
const dashboardWrapper = {
  apiVersion: "dashboard.grafana.app/v1beta1",
  kind: "Dashboard",
  metadata: {
    name: dashboard.uid!
  },
  spec: dashboard
};

// Save the formatted JSON to a file
const dashboardJSON = JSON.stringify(dashboardWrapper, null, 2);
fs.writeFileSync('dashboard.json', dashboardJSON, 'utf8');

console.log(`Dashboard JSON:\n${}`);
```

{{< /code >}}

## 2. Automate deployment with GitHub Actions

Next, set up GitHub Actions to automate the deployment of a Grafana dashboard using the Foundation SDK and the [`grafanactl` CLI tool](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/grafana-cli/) to:

- Extract the dashboard name from `dashboard.json`
- Check if the dashboard already exists within our Grafana instance
- Update it if it does, create it if it doesn’t

{{< admonition type="note" >}}
The following GitHub Action configuration assumes you are using a Go-based dashboard generator. If you're using one of the other languages that the Foundation SDK supports, modify the **Generate Dashboard JSON** step accordingly.
{{< /admonition >}}

The `.github/workflows/deploy-dashboard.yml` deploy workflow looks like:

```yaml
name: Deploy Grafana Dashboard

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Set up Go
        uses: actions/setup-go@v5
        with:
          go-version: 1.24.6

      - name: Verify Go version
        run: go version

      - name: Download and Extract grafanactl
        run: |
          curl -L -o grafanactl-x86_64.tar.gz "https://github.com/grafana/grafanactl/releases/download/${{ vars.GRAFANACTL_VERSION }}/grafanactl_Linux_x86_64.tar.gz"
          tar -xzf grafanactl-x86_64.tar.gz
          chmod +x grafanactl
          sudo mv grafanactl /usr/local/bin/grafanactl

      - name: Generate Dashboard JSON
        working-directory: ./github-actions-example
        run: go run main.go

      - name: Deploy Dashboard with grafanactl
        env:
          GRAFANA_SERVER: ${{ vars.GRAFANA_SERVER }}
          GRAFANA_STACK_ID: ${{ vars.GRAFANA_STACK_ID }}
          GRAFANA_TOKEN: ${{ secrets.GRAFANA_TOKEN }}
        run: |
          if [ -f dashboard.json ]; then
            echo "dashboard.json exists, deploying dashboard."
            grafanactl resources push dashboards --path ./dashboard.json
          else
            echo "dashboard.json does not exist."
            exit 1
          fi
        working-directory: ./github-actions-example
```

### 1. Checkout and set up Go

To set up Go:

- Check out the repository to access the project code.
- Install Go 1.24.6 using the `actions/setup-go` action.
- Verify Go is properly installed.

### 2. Download and install `grafanactl`

Next, download the `grafanactl` CLI from GitHub using the version defined in `vars.GRAFANACTL_VERSION`. It unpacks the tarball, makes it executable, and moves it to a location in the system `PATH`.

### 3. Generate the dashboard JSON

Next, run the dashboard generator (`main.go`) from the `./github-actions-example` director to produce a `dashboard.json` file that contains the Grafana dashboard definition.

### 4. Deploy the dashboard with `grafanactl`

If `dashboard.json` already exists, it is deployed to your Grafana instance using:

```bash
grafanactl resources push dashboards --path ./dashboard.json
```

This command authenticates against Grafana using the following environment variables:

- `GRAFANA_SERVER`: Your Grafana instance URL
- `GRAFANA_STACK_ID`: Your Grafana stack ID
- `GRAFANA_TOKEN`: A Grafana service account token with sufficient permissions

### GitHub variables and secrets used

Verify these variables are configured in your repository under **Settings > Security > Secrets and variables > Actions**:

- `vars.GRAFANACTL_VERSION`: Version of `grafanactl` to install
- `vars.GRAFANA_SERVER`: The URL of your Grafana instance
- `vars.GRAFANA_STACK_ID`: The stack ID in Grafana
- `secrets.GRAFANA_TOKEN`: Grafana API token

This action ensures that every push to `main` will regenerate and deploy your latest dashboard definition to Grafana.
