---
description:
keywords:
  - terraform
  - dashboard provisioning
  - CI/CD
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Automate dashboard provisioning with CI/CD
weight: 200
---

# Automate dashboard provisioning with CI/CD

## Introduction

Managing Grafana dashboards manually can be inefficient and error-prone. As you saw in the Getting Started guide, we can define dashboards using strongly typed code with the Grafana Foundation SDK. We can then commit them to version controls, and automatically deploy them using GitHub Actions.

This guide walks through:

- Generating a Grafana dashboard as code
- Formatting it for Kubernetes-style deployment
- Using GitHub Actions to deploy the dashboard
- Checking if the dashboard exists and updating it if needed

By the end, every change to your dashboard code will be automatically created or updated in your Grafana instance without manual intervention.

## 1. Generating the dashboard JSON

Before deploying a dashboard, we need to define it in code using the Grafana Foundation SDK. We ran through an example of this in the Getting Started guide, however, in order to comply with the Kubernetes resource compatible API that Grafana exposes, we’ll make some changes to the code to output the dashboard JSON in the appropriate format.

```bash
import { DashboardBuilder, RowBuilder } from '@grafana/grafana-foundation-sdk/dashboard';
import * as fs from 'fs';

// Generate the dashboard JSON
const dashboardJson = new DashboardBuilder('Sample Dashboard')
  .uid('sample-dashboard')
  .tags(['example', 'typescript'])
  .refresh('1m')
  .time({ from: 'now-30m', to: 'now' })
  .timezone('browser')
  .withRow(new RowBuilder('Overview'))
  .build();

// Convert to Kubernetes-style format
const kubernetesDashboardPayload = {
  apiVersion: "dashboard.grafana.app/v1alpha1",
  kind: "Dashboard",
  metadata: {
    name: "sample-dashboard"
  },
  spec: JSON.stringify(dashboardJson)
};

// Save the formatted JSON to a file
fs.writeFileSync('dashboard.json', JSON.stringify(kubernetesDashboardPayload, null, 2), 'utf8');

console.log('Dashboard JSON converted for Kubernetes deployment!');
```

This script:

- Generates a Grafana dashboard JSON file
- Wraps it in a Kubernetes-style API format (`apiVersion`, `kind`, `metadata`, `spec`)
- Saves it as `dashboard.json` for deployment

## 2. Automating deployment with GitHub Actions

Next, we’ll set up GitHub Actions to:
Extract the dashboard name from `dashboard.json`
Check if the dashboard already exists within our Grafana instance
Update it if it does, create it if it doesn’t

`.github/workflows/deploy-dashboard.yml`

```bash
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

            - name: Install dependencies
              run: npm install

            - name: Generate Dashboard JSON
              run: npx ts-node main.ts

            - name: Extract Dashboard Name from JSON
              run: echo "DASHBOARD_NAME=$(jq -r '.metadata.name' dashboard.json)" >> $GITHUB_ENV

            - name: Check if dashboard exists
              run: |
                HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "https://${{ vars.GRAFANA_URL }}/apis/dashboard.grafana.app/v1alpha1/namespaces/${{ vars.GRAFANA_NAMESPACE }}/dashboards/$DASHBOARD_NAME" -H "Authorization: Bearer ${{ secrets.GRAFANA_API_KEY }}")

                if [ $HTTP_STATUS -eq 200 ]; then
                  echo "DASHBOARD_EXISTS=true" >> $GITHUB_ENV
                else
                    echo "DASHBOARD_EXISTS=false" >> $GITHUB_ENV
                fi

            - name: Deploy Dashboard
              run: |
                if [ $DASHBOARD_EXISTS = "true" ]; then
                    echo "Updating existing dashboard: $DASHBOARD_NAME"
                    curl -X PUT "https://${{ vars.GRAFANA_URL }}/apis/dashboard.grafana.app/v1alpha1/namespaces/${{ vars.GRAFANA_NAMESPACE }}/dashboards/$DASHBOARD_NAME" \
                    -H "Content-Type: application/json" \
                    -H "Authorization: Bearer ${{ secrets.GRAFANA_API_KEY }}" \
                    --data-binary @dashboard.json
                else
                    echo "Creating new dashboard: $DASHBOARD_NAME"
                    curl -X POST "https://${{ vars.GRAFANA_URL }}/apis/dashboard.grafana.app/v1alpha1/namespaces/${{ vars.GRAFANA_NAMESPACE }}/dashboards" \
                    -H "Content-Type: application/json" \
                    -H "Authorization: Bearer ${{ secrets.GRAFANA_API_KEY }}" \
                    --data-binary @dashboard.json
                fi
```

## 3. explaining this GitHub action

### Checkout and install dependencies

The first two steps of the above GitHub Action simply checkout the Git repository and install the appropriate dependencies using `npm`. This prepares the action for the next step which is to generate the dashboard JSON.

### Generating the dashboard JSON

The next step is to generate the dashboard JSON that we defined in TypeScript using the Grafana Foundation SDK.

```bash
npx ts-node main.ts
```

The above outputs a `dashboard.json` file in the root directory, ready to be pushed into Grafana.

Extract the Dashboard Name
In order to make sure that we know whether we should create or update the dashboard in our Grafana instance, we’ll need to extract the name from the JSON file so that we can perform a GET request to confirm if it already exists.

```bash
echo "DASHBOARD_NAME=$(jq -r '.metadata.name' dashboard.json)" >> $GITHUB_ENV
```

This step extracts the dashboard name using `jq` and exports it into an environment variable called `DASHBOARD_NAME`.

### Check if the dashboard exists

Before we can push the dashboard to our environment we need to check if it already exists. If it does, we should use a PUT request, otherwise we will use a PUSH request to the API.

```bash
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "https://${{ vars.GRAFANA_URL }}/apis/dashboard.grafana.app/v1alpha1/namespaces/${{ vars.GRAFANA_NAMESPACE }}/dashboards/$DASHBOARD_NAME" -H "Authorization: Bearer ${{ secrets.GRAFANA_API_KEY }}")

if [ $HTTP_STATUS -eq 200 ]; then
  echo "DASHBOARD_EXISTS=true" >> $GITHUB_ENV
else
  echo "DASHBOARD_EXISTS=false" >> $GITHUB_ENV
fi
```

The above makes a `GET` request to the API to check for the existence of the dashboard. It stores the result (TRUE/FALSE) as an environment variable called `DASHBOARD_EXISTS` which we can query in the next step to perform the appropriate API call.

### Deploy the Dashboard to Grafana

Now that we have our dashboard as a JSON payload and we know whether or not it already exists, we can deploy it to our Grafana instance.

```bash
if [ $DASHBOARD_EXISTS = "true" ]; then
                    echo "Updating existing dashboard: $DASHBOARD_NAME"
                    curl -X PUT "https://${{ vars.GRAFANA_URL }}/apis/dashboard.grafana.app/v1alpha1/namespaces/${{ vars.GRAFANA_NAMESPACE }}/dashboards/$DASHBOARD_NAME" \
                    -H "Content-Type: application/json" \
                    -H "Authorization: Bearer ${{ secrets.GRAFANA_API_KEY }}" \
                    --data-binary @dashboard.json
                else
                    echo "Creating new dashboard: $DASHBOARD_NAME"
                    curl -X POST "https://${{ vars.GRAFANA_URL }}/apis/dashboard.grafana.app/v1alpha1/namespaces/${{ vars.GRAFANA_NAMESPACE }}/dashboards" \
                    -H "Content-Type: application/json" \
                    -H "Authorization: Bearer ${{ secrets.GRAFANA_API_KEY }}" \
                    --data-binary @dashboard.json
                fi
```

The above checks the`DASHBOARD_EXISTS` environment variable and makes sure that we call the appropriate API endpoint with the dashboard JSON payload depending on whether or not it already exists or we’re creating a new one.

You will notice that the above script uses a number of variables and secrets which can be configured directly within GitHub, these are:

- `vars.GRAFANA_URL` - The root URL of your Grafana instance
- `vars.GRAFANA_NAMESPACE` - The org name or stack identifier for your Grafana instance
- `secrets.GRAFANA_API_KEY` - Your Grafana service account secret key

You can configure these variables in GitHub by going to your repository’s Settings tab and then the Security -> Secrets and variables -> Actions page.

### Why automate this?

Automating Grafana dashboard deployment eliminates the need for manual dashboard creation and updates, ensuring that dashboards remain consistent across environments. By defending dashboards as code and managing them through CI/CD such as GitHub Actions, we gain full version control, making it easy to track changes over time and roll back if needed. This also prevents duplication, as the workflow intelligently checks whether a dashboard exists before deciding to create or update it. With this fully automated CI/CD pipeline, developers can focus on improving their dashboards rather than manually uploading JSON files to Grafana.

### Conclusion

By integrating the Grafana Foundation SDK with GitHub Actions, we have successfully automated the entire lifecycle of Grafana dashboards. This setup allows us to define dashboards programmatically, convert them into a Kubernetes-compatible format, and deploy them automatically. With each push to the repository, the workflow ensures that dashboards are either created or updated as needed. This not only improves the efficiency but also guarantees that all deployed dashboards are always in sync with the latest code changes, reducing manual effort and potential errors.
