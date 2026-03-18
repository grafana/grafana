---
name: grafana-docs
description: >-
  Applies the Grafana documentation style guide when authoring or editing docs
  in the Grafana repo. Use when working in docs/, documentation, writing docs,
  editing docs/sources, or when the user refers to docs/AGENTS.md or the docs
  style guide.
---

# Grafana docs authoring

When authoring or editing documentation under the Grafana repository's `docs/` directory, read and follow the Documentation Style Guide.

## Required reading

**Read and apply:** `docs/AGENTS.md` at the repository root.

That file defines role, structure, copy, tense, voice, wordlist, formatting, and shortcode usage for Grafana docs.

## Critical points

- **Product naming:** Full names on first mention (e.g. Grafana Alloy, Grafana Cloud), then short names. Use "OpenTelemetry" and "Kubernetes" in full; present signals as metrics, logs, traces, profiles.
- **Structure:** Articles have clear headings; front matter `title` matches the h1; copy appears after every heading.
- **Voice:** Active voice, second person ("you"); present simple tense; simple words and contractions.

For the full set of rules (APIs, CLI, shortcodes, images, lists), use the content of `docs/AGENTS.md`.
