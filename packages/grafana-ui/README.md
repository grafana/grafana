# Grafana UI components library

> **@grafana/ui is currently in BETA**.

@grafana/ui is a collection of components used by [Grafana](https://github.com/grafana/grafana)

Our goal is to deliver Grafana's common UI elements for plugins developers and contributors.

See [package source](https://github.com/grafana/grafana/tree/master/packages/grafana-ui) for more details.

## Installation

`yarn add @grafana/ui`

`npm install @grafana/ui`

## Development

For development purposes we suggest using `yarn link` that will create symlink to @grafana/ui lib. To do so navigate to `packages/grafana-ui` and run `yarn link`. Then, navigate to your project and run `yarn link @grafana/ui` to use the linked version of the lib. To unlink follow the same procedure, but use `yarn unlink` instead.

### Storybook 6.x migration

We've upgraded Storybook to version 6 and with that we will convert to using [controls](https://storybook.js.org/docs/react/essentials/controls) instead of knobs
for manipulating components. Controls will not require as much coding as knobs do.

The [button story](https://github.com/grafana/grafana/blob/master/packages/grafana-ui/src/components/Button/Button.story.tsx) has been migrated as a test. Here's a basic guide on how to migrate a story to controls.


1. Remove the `@storybook/addon-knobs` dependency.
2. Import the Story type from `@storybook/react`
 
   `import { Story } from @storybook/react`
3. Import the props interface from the component you're working on (these must be exported in the component).
 
   `import { Props } from './Component'`
4. Add the Story type to all stories in the file, replace the props sent to the component
and remove any knobs.

    Before
    ```tsx
    export const Simple = () => {
      const prop1 = text('Prop1', 'Example text');
      const prop2 = select('Prop2', ['option1', 'option2'], 'option1');
    
      return <Component prop1={prop1} prop2={prop2} />; 
    }
    ```

    After
    ```tsx
    export const Simple: Story<Props> = ({ prop1, prop2 }) => {
      return <Component prop={prop1} prop2={prop2} />;       
    }
    ```
   
5. Add default props (or args in Storybook language).

    ```tsx
    Simple.args = {
      prop1: 'Example text',
      prop2: 'option 1'
    }
    ```

6. If the component have advanced props type (ie. other than string, number, boolean). You need to 
specify these in an `argsTable`. This is done in the default export of the story.

    ```tsx
    export default {
      title: 'Component/Component',
      component: Component,
      argTypes: {
        prop2: { control: { type: 'select', options: ['option1', 'option2'] } },
      },
    };
    ```
    
