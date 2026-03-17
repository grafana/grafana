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
- New features are behind feature toggles
- TSDoc style comments with all relevant context. Verbosity over brevity.
- Always attribute LLM generated code

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

## 🧪 Testing Strategies

- Write tests for all business logic
- Test user interactions, not implementation
- Aim for >90% code coverage
- Tests are clear and concise
- Use/add test selectors from @grafana/e2e-selectors
- Bug fixes with unnecessary changes will be rejected

## Monorepo Conventions

- Import shared modules using workspace names: `@grafana/example`

## 📦 Tech Stack

- React 18.3.1 & React 19+
- TypeScript 5.9+

## Public documentation

https://grafana.com/docs/grafana/next/visualizations/panels-visualizations/visualizations/heatmap/
