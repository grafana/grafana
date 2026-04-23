---
aliases:
description: Grafana Assistant for on-prem instances
keywords:
labels:
  products:
    - enterprise
    - oss
menutitle: Grafana Assistant
title: Grafana Assistant
weight: 100
---

# Grafana Assistant

Starting in Grafana v13, you can use Grafana Assistant on-premise by installing the Assistant app in your self-hosted Grafana deployment and connecting it to a Grafana Cloud stack.

Grafana Assistant on-premise keeps the Assistant experience inside your Grafana deployment. After setup, you can use Assistant to work with metrics, logs, traces, profiles, and databases, create and update dashboards, generate queries, and navigate Grafana resources from natural language prompts. However, it doesn’t include every Grafana Cloud feature. Refer to [Available Assistant features for Grafana on-prem](#available-assistant-features-for-grafana-on-prem) for details on the supported services.

For more information refer to the [Grafana Assistant documentation](https://grafana.com/docs/grafana-cloud/machine-learning/assistant/).

## Before you begin

Grafana Assistant on-premise needs access in both your self-hosted Grafana deployment and a Grafana Cloud stack.

The following is required:

- A Grafana Cloud stack with Assistant enabled
- A self-hosted Grafana deployment
- Organization administrator access in the self-hosted Grafana deployment
- Administrator access in the Grafana Cloud stack that will back the deployment
- The Grafana Assistant app available in the self-hosted Grafana deployment

### Usage limits

The Assistant UI runs in your self-hosted Grafana deployment. The Assistant backend, usage limits, and billing stay in the Grafana Cloud stack that you connect during setup. If you run Grafana OSS or Grafana Enterprise, this is the supported way to use Assistant outside Grafana Cloud.

## Available Assistant features for Grafana on-prem

Grafana Assistant on-premise hides features that depend on the full Grafana Cloud backend, keeping the following chat workflows available:

- Chat and prompt-based assistance
- Dashboard creation and editing
- Query generation and explanation
- Navigation across Grafana resources
- Rules, quickstarts, and skills
- MCP server integrations

The following features are not available on-premise:

- Assistant investigations and related investigation memory features
- Infrastructure memory
- Grafana Cloud MCP connections
- CLI auth tokens
- SQL table discovery
- Automations and sandbox settings
- Anonymous access to the Assistant app

## Use Assistant on-prem

Grafana Assistant on-premise connects your self-hosted Grafana deployment to the Grafana Cloud stack that provides the backend services.

- To set up Assistant on-prem refer to [Connect to your deployment](https://grafana.com/docs/grafana-cloud/machine-learning/assistant/on-premise/#connect-your-deployment) in the main Assistant documentation.
- For management options and pricing, refer to [Manage access and usage information](https://grafana.com/docs/grafana-cloud/machine-learning/assistant/on-premise/#manage-access-and-usage).
