# Frontend style guide

Grafana Labs follows the [Airbnb React/JSX Style Guide](https://github.com/airbnb/javascript/tree/master/react) in matters pertaining to React. This guide provides highlights of the style rules we follow.

## Basic rules

- Try to keep files small and focused.
- Break large components up into sub-components.
- Use spaces for indentation.

## Naming conventions

Follow these guidelines when naming elements of your code.

### Class names

Use PascalCase. For example:

```typescript
// bad
class dataLink {
  //...
}

// good
class DataLink {
  //...
}
```

### Constants

Use ALL CAPS for constants. For example:

```typescript
// bad
const constantValue = "This string won't change";
// bad
const constant_value = "This string won't change";

// good
const CONSTANT_VALUE = "This string won't change";
```

### Emotion class names

Use camelCase. For example:

```typescript
const getStyles = (theme: GrafanaTheme2) => ({
  // bad
  ElementWrapper: css`...`,
  // bad
  ['element-wrapper']: css`...`,

  // good
  elementWrapper: css({
    padding: theme.spacing(1, 2),
    background: theme.colors.background.secondary,
  }),
});
```

Use hook useStyles2(getStyles) to memoize the styles generation and try to avoid passing props to the getStyles function and instead compose classes using Emotion CX function.

### Enums

Use PascalCase. For example:

```
// bad
enum buttonVariant {
 //...
}

// good
enum ButtonVariant {
 //...
}
```

### Files and directories

Name files according to the primary export:

- When the primary export is a class or React component, use PascalCase.
- When the primary export is a function, use camelCase.

For files that export multiple utility functions, use the name that describes the responsibility of grouped utilities. For example, a file that exports math utilities should be named `math.ts`.

- Use `constants.ts` for files that export constants.
- Use `actions.ts` for files that export Redux actions.
- Use `reducers.ts` for Redux reducers.
- Use `*.test.ts(x)` for test files.

For directory names, use dash-case (sometimes called kebab-case).

- Use `features/new-important-feature/utils.ts`

### Functions

Use camelCase. For example:

```typescript
// bad
const CalculatePercentage = () => { ... }
// bad
const calculate_percentage = () => { ... }

// good
const calculatePercentage = () => { ... }
```

### Interfaces

Use PascalCase. For example:

```
// bad
interface buttonProps {
  //...
}
// bad
interface button_props {
  //...
}
// bad
interface IButtonProps {
  //...
}

// good
interface ButtonProps {
  //...
}

// bad
type requestInfo = ...
// bad
type request_info = ...

// good
type RequestInfo = ...
```

### Methods

Use camelCase. For example:

```typescript
class DateCalculator {
  // bad
  CalculateTimeRange () {...}
}
class DateCalculator {
  // bad
  calculate_time_range () {...}
}

class DateCalculator {
  // good
  calculateTimeRange () {...}
}
```

### React components

Follow these guidelines for naming React components.

#### React callback props and handlers

Name callback props and handlers with an _on_ prefix. For example:

```tsx
// bad
handleChange = () => {

};

render() {
  return (
    <MyComponent changed={this.handleChange} />
  );
}

// good
onChange = () => {

};

render() {
  return (
    <MyComponent onChange={this.onChange} />
  );
}

```

#### React component constructor

Use the following convention when implementing these React components:

```typescript
// bad
constructor(props) {...}

// good
constructor(props: Props) {...}
```

#### React component defaultProps

Use the following convention when implementing these React components:

```typescript
// bad
static defaultProps = { ... }

// good
static defaultProps: Partial<Props> = { ... }
```

#### React component definitions

Use the following convention when implementing these React components:

```jsx
// bad
export class YourClass extends PureComponent { ... }

// good
export class YourClass extends PureComponent<{},{}> { ... }
```

#### React state and properties

Use camelCase. For example:

```typescript
interface ModalState {
  // bad
  IsActive: boolean;
  // bad
  is_active: boolean;

  // good
  isActive: boolean;
}
```

### SASS

SASS styles are deprecated. You should migrate to Emotion whenever you need to modify SASS styles.

### Types

In general, you should let TypeScript infer the types so that there's no need to explicitly define the type for each variable.

There are some exceptions to this:

```typescript
// TypeScript needs to know the type of arrays or objects; otherwise, it infers type as an array of any

// bad
const stringArray = [];

// good
const stringArray: string[] = [];
```

Specify function return types explicitly in new code. This improves readability by being able to tell what a function returns just by looking at the signature. It also prevents errors when a function's return type is broader than expected by the author.

> **Note:** Linting is not enabled for this issue because there is old code that needs to be fixed first.

```typescript
// bad
function transform(value?: string) {
  if (!value) {
    return undefined;
  }
  return applyTransform(value);
}

// good
function transform(value?: string): TransformedValue | undefined {
  if (!value) {
    return undefined;
  }
  return applyTransform(value);
}
```

### Variables

Use camelCase. For example:

```typescript
// bad
const QueryTargets = [];
// bad
const query_targets = [];

// good
const queryTargets = [];
```

## Code organization

Organize your code in a directory that encloses feature code:

- Put Redux state and domain logic code in the `state` directory (for example, `features/my-feature/state/actions.ts`).
- Put React components in the `components` directory (for example, `features/my-feature/components/ButtonPeopleDreamOf.tsx`).
- Put test files next to the test subject.
- Put containers (pages) in the feature root (for example, `features/my-feature/DashboardPage.tsx`).
- Put API function calls that aren't a Redux thunk in an `api.ts` file within the same directory.
- Subcomponents should live in the component folders. Small components don't need their own folder.
- Component SASS styles should live in the same folder as component code.

For code that needs to be used by an external plugin:

- Put components and types in `@grafana/ui`.
- Put data models and data utilities in `@grafana/data`.
- Put runtime services interfaces in `@grafana/runtime`.

### Exports

- Use named exports for all code you want to export from a file.
- Use declaration exports (that is, `export const foo = ...`).
- Avoid using default exports (for example, `export default foo`).
- Export only the code that is meant to be used outside the module.

### Code comments

- Use [TSDoc](https://github.com/microsoft/tsdoc) comments to document your code.
- Use [react-docgen](https://github.com/reactjs/react-docgen) comments (`/** ... */`) for props documentation.
- Use inline comments for comments inside functions, classes, etc.
- Please try to follow the [code comment guidelines](./code-comments.md) when adding comments.

## Linting

Linting is performed using [@grafana/eslint-config](https://github.com/grafana/eslint-config-grafana).

## Functional components

Use function declarations instead of function expressions when creating a new React functional component. For example:

```typescript
// bad
export const Component = (props: Props) => { ... }

// bad
export const Component: React.FC<Props> = (props) => { ... }

// good
export function Component(props: Props) { ... }
```

## State management

- Don't mutate state in reducers or thunks.
- Use `createSlice`. See [Redux Toolkit](https://redux-toolkit.js.org/) for more details.
- Use `reducerTester` to test reducers. See [Redux framework](redux.md) for more details.
- Use state selectors to access state instead of accessing state directly.
