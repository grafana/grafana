# Frontend Style Guide

Generally we follow the Airbnb [React Style Guide](https://github.com/airbnb/javascript/tree/master/react).

## Table of Contents

- [Frontend Style Guide](#frontend-style-guide)
  - [Table of Contents](#table-of-contents)
  - [Basic rules](#basic-rules)
  - [Naming](#naming)
  - [Files and directories naming](#files-and-directories-naming)
  - [Code organization](#code-organization)
    - [Exports](#exports)
  - [Comments](#comments)
  - [React](#react)
    - [Props](#props)
  - [State management](#state-management)

## Basic rules

- Try to keep files small and focused.
- Break large components up into sub-components.
- Use spaces for for indentation

### Naming
- Use `PascalCase` for
    - class names
    - interfaces
    - types
    - enums
- Use `camelCase`
    - functions
    - methods
    - variables
    - state
    - properties
- Use `ALL_CAPS` for constants


### Files and directories naming

Name files according to the primary export:
- when primary export is a class or React component, use PascalCase
- when primary export is a function, use camelCase
    
For files exporting multiple utility functions use the name that describes the reponsibility of grouped utils. For example, file exporting math utilities should be named `math.ts`

- Use `constants.ts` for files exporting constants
- Use `actions.ts` for files exporting Redux actions
- Use `reducers.ts` Redux reducers
- Use `*.test.ts(x)` for test files

### Code organisation
Organise your code in a directory that encloses feature code:
- Put Redux state and domain logic code in `state` directory (i.e. `features/my-feature/state/actions.ts`)
- Put React components in `components` directory (i.e. `features/my-feature/components/ButtonPeopleDreamOf.tsx`)
- Put test files next to the test subject
- Put containers(pages) in feature root (i.e. `features/my-feature/DashboardPage.tsx`)
- Sub components can live in that component folders, so small component do not need their own folder
- Component's SASS styles should live in the same folder as component code

For code that needs to be used by external plugin:
- Put components and types in `@grafana/ui`
- Put data models and data utilities in `@grafana/data`
- Put runtime services interfaces in `@grafana/runtime`

#### Exports
- Use named exports for all code you want to export from a file. 
- Use declaration exports (i.e. `export const foo = ... `)
- Export only the code that is meant to be used outside the module

### Comments
- Use (TSDoc)[https://github.com/microsoft/tsdoc] comments to document your code
- Use (react-docgen)[https://github.com/reactjs/react-docgen] comments (`/** ... */`) for props documentation
- Use inline comments for comments inside functions, classes etc.

### Linting
Linting is performed using (@grafana/eslint-config)[https://github.com/grafana/eslint-config-grafana]


 
## React 
### Props

- Name callback props and handlers with an "on" prefix.

```tsx
// good
onChange = () => {

};

render() {
  return (
    <MyComponent onChange={this.onChange} />
  );
}

// bad
handleChange = () => {

};

render() {
  return (
    <MyComponent changed={this.handleChange} />
  );
}
```

- React Component definitions

```jsx
// good
export class YourClass extends PureComponent<{},{}> { ... }

// bad
export class YourClass extends PureComponent { ... }
```

- React Component constructor

```typescript
// good
constructor(props:Props) {...}

// bad
constructor(props) {...}
```

- React Component defaultProps

```typescript
// good
static defaultProps: Partial<Props> = { ... }

// bad
static defaultProps = { ... }
```

## State management

- Don't mutate state in reducers or thunks.
- Use helpers `actionCreatorFactory` and `reducerFactory` instead of traditional `switch statement` reducers in Redux. See [Redux framework](redux.md) for more details.
- Use `reducerTester` to test reducers. See [Redux framework](redux.md) for more details.
- Use state selectors to access state instead of accessing state directly.
