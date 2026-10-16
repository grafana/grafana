---
description: Overview and comparison of the AI  tools available in Grafana
keywords:
  - as code
  - AI
  - AI tools
  - Assistant
  - agents
  - gcx
  - CLI
  - MCP server
  - MCP
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Available AI tools in Grafana 
menuTitle: AI tools overview
weight: 300
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/
aliases:
---

# Available AI tools in Grafana 

If you're a Grafana on prem user, you have the following AI tools available to interact with Grafana:

**Grafana Assistant** is Grafana's own AI agent, built into Grafana. Assistant brings a purpose-built LLM into Grafana so operators, developers, and SREs can troubleshoot issues, manage dashboards, and answer product questions in plain language. 

  - In self-managed Grafana the Assistant app runs in your own deployment but connects to a Grafana Cloud Assistant backend, with a reduced feature set. 
  - Some advanced features require the full Grafana Cloud feature set.
  - Assistant is billed per token consumed, including requests made through `gcx`. 

**MCP servers** let an external AI client (for example Claude, Cursor, or VS Code with Copilot) call Grafana as a set of tools that cover the operational loop: dashboards and folders, data sources (Prometheus, Loki, and others), alerting, incidents, OnCall, and more.  

  - Clients discover named tools with JSON schemas, the model picks a tool and supplies structured arguments, Grafana runs it under normal identity and RBAC, and the structured result goes back to the model for its next step. 
  - Grafana offers two servers: Cloud MCP (hosted by Grafana) and OSS MCP (you run it).

`**gcx**` is an AI-native command-line tool that gives you or your AI agent structured access to Grafana (dashboards, folders, alert rules, data sources) and Grafana Cloud products such as Synthetic Monitoring, k6, Fleet Management, Incidents, and Adaptive Telemetry. It's deterministic and scriptable, and provides JSON or YAML output, structured errors, and predictable exit codes. Use it for scripts, CI, or GitOps. 

## Side-by-side comparison

This table summarizes the main points for each tool:

| | Grafana Assistant | Cloud MCP | OSS MCP | gcx |
|---|---|---|---|---|
|**What it is**| Grafana's built-in AI agent | Grafana-hosted MCP endpoint for external AI clients | Self-run MCP server (`mcp-grafana`) | CLI for Grafana and Grafana Cloud | 
|**Who drives it**| A person, inside Grafana | A person, through an MCP client | A person or an agent, through an MCP client | A person, a script, or a coding agent issuing explicit commands | 
|**Setup**| In Cloud, there's nothing to install, just enable it in stack. Install app for self-managed | Add one endpoint to a client; complete browser consent | Install and operate a server | Install the binary and configure contexts | 
|**Best for**| Ad hoc questions, dashboards, investigations in the UI | Interactive diagnosis from your AI client with per-user permissions | Self-hosted, private networks, service identity, custom policy | Repeatable work, CI, GitOps, multi-stack changes | 
|**Cost note**| Per token consumed | Counts toward Assistant usage and active users | Server hosting is yours; Grafana usage rules apply | Free. Cloud products and Assistant requests are billed as usual | 

## When to use which

|I... | Use | Why? |
|---|---|---|
|Want an answer, a query, or a dashboard fast from the Grafana UI | Assistant | No setup, and Grafana manages context. |
|have an unattended or shared workflow that needs a service identity |OSS MCP or `gcx` with a service token|User OAuth fits a person at the keyboard. | 
|Need custom transport, TLS, tool categories, or server-side policy | OSS MCP | It offers the deepest server-side tuning.| 
|have CI pipelines, GitOps, dashboards as code, or work across several stacks | `gcx` | Explicit commands, exit codes, and named contexts make changes repeatable and reviewable.|
|Want conversational diagnosis followed by a reviewed change | MCP for diagnosis, `gcx` for the change | Refer to Use them together. | 
|Use a coding agent needs flexibility to build its own workflows | `gcx` | `gcx` is as a broader, less opinionated toolset. | 

### Use them together

You may use a composite pattern for coding agents: for example, use MCP for conversational discovery and diagnosis, then move durable changes into explicit `gcx` commands and version-controlled files. 

[ai-tools.png](./ai-tools.png)

