# 📋 Heatmap - Grafana monorepo plugin - React TypeScript

## 🎯 PROJECT CONTEXT

- **Repo guidance**: See [AGENTS.md](../../../../../AGENTS.md) at the repo root for build, test, and architecture patterns
- **Generic panel visualization guidance**: See [AGENTS.md](../AGENTS.md)

## 🔧 DEVELOPMENT PATTERNS

### State Management

- [HeatmapPanelProps](./panelcfg.gen.ts) changes requires team sign-off

## User documentation

https://grafana.com/docs/grafana/next/visualizations/panels-visualizations/visualizations/heatmap/

## Implementation overview

- Renders Heatmap panel plugin
- UPlot renders canvas visualization
- UPlot hooks manage canvas user interactions which render React components (e.g. Tooltip)
- Supports Exemplars and Annotations

## Scripts

- Code coverage: `yarn jest --coverage --collectCoverageFrom="public/app/plugins/panel/heatmap/**/*.{ts,tsx}" public/app/plugins/panel/heatmap/`
- ESLint: `yarn eslint public/app/plugins/panel/heatmap/ --fix`
- Prettier: `yarn prettier public/app/plugins/panel/heatmap/ --write`
