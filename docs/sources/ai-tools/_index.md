---
description: Tools that let you and your AI agents work with Grafana.
keywords:
  - AI tools
  - AI agents
  - CLI
  - gcx
  - MCP server
  - Grafana Assistant
  - Assistant
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: AI tools
title: AI tools
weight: 800
cards:
  items:
    - title: Grafana Assistant
      height: 24
      href: ./grafana-assistant/
      description: Install Grafana Assistant in self-managed Grafana and connect it to a Grafana Cloud stack.
    - title: MCP server
      height: 24
      href: ./mcp/
      description: Connect AI assistants and LLM clients to Grafana using the Model Context Protocol.
    - title: gcx CLI
      height: 24
      href: ./grafana-cli/
      description: Use `gcx`, a command-line tool you can run yourself or hand to an AI agent, to authenticate, manage multiple environments, and perform administrative tasks from the terminal.
  title_class: pt-0 lh-1
canonical: https://grafana.com/docs/grafana/latest/ai-tools/
---

# AI tools

Grafana has a set of tools that let you and your AI agents work with Grafana:

- **Grafana Assistant** brings a purpose-built LLM to Grafana so operators, developers, and SREs can troubleshoot issues, manage dashboards, and answer product questions in minutes.
- The **MCP server** exposes a fixed set of tools for common use cases, either self-hosted or through a hosted Cloud endpoint.
- **`gcx`** is a flexible CLI that agents can use to build custom workflows.

## Should I use Grafana Assistant, MCP server, or `gcx`?

Each of the available tools fits a specific use case.

| I want...                                                                                          | Use                                                                                      |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Interactive help inside Grafana                                                                    | [Grafana Assistant](https://grafana.com/docs/grafana-cloud/platform/grafana-assistant/). |     |
| Curated, ready-made Grafana tools for an external AI client                                        | [MCP server](https://grafana.com/docs/grafana-cloud/ai-tools/mcp-servers/)               |
| A broader interface you can script for automation, GitOps, and coding agents that need flexibility | [`gcx`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/ai-tools/grafana-cli)         |

Note that Assistant use is charged per token, including requests made through `gcx`.

## Explore

{{< card-grid key="cards" type="simple" >}}
