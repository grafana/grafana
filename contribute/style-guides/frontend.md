# Frontend Style Guide

Generally we follow the Airbnb [React Style Guide](https://github.com/airbnb/javascript/tree/master/react).

## Table of Contents

- [Frontend Style Guide](#frontend-style-guide)
  - [Table of Contents](#table-of-contents)
  - [Basic rules](#basic-rules)
  - [Naming conventions](#naming-conventions)
  - [Files and directories naming conventions](#files-and-directories-naming-conventions)
  - [Code organization](#code-organization)
    - [Exports](#exports)
  - [Comments](#comments)
  - [React](#react)
    - [Props](#props)
  - [State management](#state-management)

## Basic rules

- Try to keep files small and focused.
- Break large components up into sub-components.
- Use spaces for indentation

### Naming conventions

#### Use `PascalCase` for:

1. Typescript class names

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

2. Types and interfaces

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

3. Enums

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

#### Use `camelCase` for:

1. Functions

   ```typescript
   // bad
   const CalculatePercentage = () => { ... }
   // bad
   const calculate_percentage = () => { ... }

   // good
   const calculatePercentage = () => { ... }
   ```

2. Methods

   ```typescript
   class DateCalculator {
     // bad
     CalculateTimeRange () {...}
   }
   class DateCalculator {
     // bad
     calculate_timee_range () {...}
   }

   class DateCalculator {
     // good
     calculateTimeRange () {...}
   }
   ```

3. Variables

   ```typescript
   // bad
   const QueryTargets = [];
   // bad
   const query_targets = [];

   // good
   const queryTargets = [];
   ```

4. React state and properties

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

5. Emotion class names

   ```typescript
   const getStyles  = = () => ({
     // bad
     ElementWraper: css`...`,
     // bad
     ["element-wrapper"]: css`...`,

     // good
     elementWrapper: css`...`,
   });
   ```

#### Use `ALL_CAPS` for constants

#### Use [BEM](http://getbem.com/) convention for SASS styles
_SASS styles are deprecated, ideally migrate to Emotion whenever you need to modify SASS styles_

### Files and directories naming conventions

Name files according to the primary export:

- When the primary export is a class or React component, use PascalCase.
- When the primary export is a function, use camelCase.

For files exporting multiple utility functions, use the name that describes the responsibility of grouped utilities. For example, a file exporting math utilities should be named `math.ts`.

- Use `constants.ts` for files exporting constants
- Use `actions.ts` for files exporting Redux actions
- Use `reducers.ts` Redux reducers
- Use `*.test.ts(x)` for test files

### Code organization

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
- Use declaration exports (i.e. `export const foo = ...`)
- Export only the code that is meant to be used outside the module

### Comments

- Use [TSDoc](https://github.com/microsoft/tsdoc) comments to document your code
- Use [react-docgen](https://github.com/reactjs/react-docgen) comments (`/** ... */`) for props documentation
- Use inline comments for comments inside functions, classes etc.

### Linting

Linting is performed using [@grafana/eslint-config](https://github.com/grafana/eslint-config-grafana)

## React

### Props

1. Name callback props and handlers with an "on" prefix.

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

2. React Component definitions

   ```jsx
   // bad
   export class YourClass extends PureComponent { ... }

   // good
   export class YourClass extends PureComponent<{},{}> { ... }
   ```

3. React Component constructor

   ```typescript
   // bad
   constructor(props) {...}

   // good
   constructor(props: Props) {...}
   ```

4. React Component defaultProps

   ```typescript
   // bad
   static defaultProps = { ... }

   // good
   static defaultProps: Partial<Props> = { ... }
   ```

## State management

- Don't mutate state in reducers or thunks.
- Use helpers `actionCreatorFactory` and `reducerFactory` instead of traditional `switch statement` reducers in Redux. See [Redux framework](redux.md) for more details.
- Use `reducerTester` to test reducers. See [Redux framework](redux.md) for more details.
- Use state selectors to access state instead of accessing state directly.
