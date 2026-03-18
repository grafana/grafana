# 📋 Panel Visualizations - Grafana monorepo plugins - React TypeScript

## 🚨 CRITICAL RULES

- Always use TypeScript strict mode
- Components must be functional with hooks
- Follow atomic design principles
- Never commit without running tests
- Use ESLint and Prettier for code formatting
- Use package imports from other @grafana packages instead of relative imports
- No direct imports from other directories in /public/app/plugins/panel/\*
- Avoid regression
- TSDoc style comments with all relevant context. Verbosity over brevity.

## 🎯 PROJECT CONTEXT

- **Repo guidance**: See [AGENTS.md](../../../../AGENTS.md) at the repo root for build, test, and architecture patterns
- **Plugin specific guidance**: public/app/plugins/panel/<plugin-name>/AGENTS.md
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
- PanelOptions schema changes requires team sign-off
- - Create issue on GitHub with detailed description of use-case and examples. Assign to grafana/dataviz-squad for review.

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

## Performance

- Follow performance best practices for React and Typescript
- Avoid unnecessary re-rendering
- Use for loops instead of forEach

## Monorepo Conventions

- Import shared modules using workspace names: `@grafana/example`

## User Documentation

https://grafana.com/docs/grafana/next/visualizations/panels-visualizations/visualizations/

## Scripts

- Code coverage: `yarn jest --coverage --collectCoverageFrom="public/app/plugins/panel/<plugin-name>/**/*.{ts,tsx}" public/app/plugins/panel/<plugin-name>/`
- ESLint: `yarn eslint public/app/plugins/panel/<plugin-name>/ --fix`
- Prettier: `yarn prettier public/app/plugins/panel/<plugin-name>/ --write`
