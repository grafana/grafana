# 📋 Heatmap - Grafana monorepo plugin - React TypeScript

## 🚨 CRITICAL RULES

- Always use TypeScript strict mode
- Components must be functional with hooks
- Follow atomic design principles
- Never commit without running tests
- Use ESLint and Prettier for code formatting
- Use package imports from other @grafana packages instead of relative imports
- No direct imports from other directories in /public/app/plugins/panel/\*
- Avoid regression at all costs
- TSDoc style comments with all relevant context. Verbosity over brevity.

## 🎯 PROJECT CONTEXT

- **Repo guidance**: See [AGENTS.md](../../../../../AGENTS.md) at the repo root for build, test, and architecture patterns
- **Project Type**: React with TypeScript
- **Architecture**: Component-based
- **Build Tool**: Webpack
- **Testing**: Jest + React Testing Library
- **Docs**: Clearly document user facing behavior

## 🔧 DEVELOPMENT PATTERNS

### Component Structure

- Use functional components with hooks
- Implement proper TypeScript types for props
- Follow single responsibility principle
- Keep components small and focused

### State Management

- Use React hooks (useState, useReducer) for local state
- HeatmapPanelProps changes requires team sign-off

### Error Handling

- Implement error boundaries
- Use try-catch for async operations
- Provide user-friendly error messages

### Typescript

- Never add non-null assertion operators
- Never add type assertions

## 🧪 Testing Strategies

- Write tests for all business logic
- Test user interactions, not implementation
- Aim for >95% code coverage for new changes
- Tests are clear and concise
- Test utility methods are well documented and flexible

## Monorepo Conventions

- Import shared modules using workspace names: `@grafana/example`

## Public documentation

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
