---
description: Use Grafana Assistant in self-managed Grafana by connecting it to a Grafana Cloud stack.
keywords:
  - Grafana Assistant
  - Assistant
  - AI
  - self-managed
  - Grafana OSS
  - Grafana Enterprise
labels:
  products:
    - enterprise
    - oss
cards:
  items:
    - title: Self-managed Grafana
      height: 24
      href: ./self-managed/
      description: Install the Grafana Assistant app in a self-managed Grafana instance, connect it to a Grafana Cloud stack, and review the reduced feature set compared with Grafana Cloud.
  title_class: pt-0 lh-1
menuTitle: Grafana Assistant
title: Grafana Assistant
weight: 10
canonical: https://grafana.com/docs/grafana/latest/ai-tools/grafana-assistant/
---

# Grafana Assistant

Grafana Assistant is an AI-powered observability agent. You ask it questions in plain language, and it works across your metrics, logs, traces, profiles, and databases.

If you run Grafana OSS or Grafana Enterprise, you can install the Assistant app in your self-managed Grafana deployment and connect it to a Grafana Cloud stack. The Assistant UI runs in your deployment, while the backend services, usage limits, and billing stay in the Grafana Cloud stack you connect.

For the full Grafana Assistant documentation, refer to [Grafana Assistant](https://grafana.com/docs/grafana-cloud/platform/grafana-assistant/) in the Grafana Cloud documentation.

## Before you begin

Grafana Assistant on-premise needs access in both your self-hosted Grafana deployment and a Grafana Cloud stack.

The following is required:

- A Grafana Cloud stack with Assistant enabled
- A self-hosted Grafana deployment
- Organization administrator access in the self-hosted Grafana deployment
- Administrator access in the Grafana Cloud stack that will back the deployment
- The Grafana Assistant app available in the self-hosted Grafana deployment

## Use Assistant on-prem

- To set up Assistant on-prem refer to [Connect to your deployment](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/ai-tools/grafana-assistant/self-managed#connect-your-deployment) in the main Assistant documentation.
- For a list of available features, refer to [Review available features](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/ai-tools/grafana-assistant/self-managed#review-available-features).
- For management options and pricing, refer to [Manage access and usage information](https://grafana.com/docs/grafana-cloud/machine-learning/assistant/on-premise/#manage-access-and-usage).
