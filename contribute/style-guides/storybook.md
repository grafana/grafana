# Storybook

[Storybook](https://storybook.js.org/) is a tool which Grafana uses to manage our design system and its components. Storybook consists of _stories_. Each story represents a component and the case in which it is used.

To show a wide variety of use cases is good both documentation wise and for troubleshooting—it might be possible to reproduce a bug for an edge case in a story.

Storybook is:

- A good way to publish our design system with its implementations
- Used as a tool for documentation
- Used for debugging and displaying edge cases

## How to create stories

Stories for a component should be placed next to the component file. The Storybook file requires the same name as the component file. For example, a story for `SomeComponent.tsx` has the file name `SomeComponent.story.tsx`.

If a story should be internal—not visible in production—name the file `SomeComponent.story.internal.tsx`.

### Writing stories

When writing stories, we use the [CSF format](https://storybook.js.org/docs/formats/component-story-format/).

> **Note:** For more in-depth information on writing stories, see [Storybook’s documentation](https://storybook.js.org/docs/basics/writing-stories/).

With the CSF format, the default export defines some general information about the stories in the file:

- **`title`**: Where the component is going to live in the hierarchy
- **`decorators`**: A list which can contain wrappers or provide context, such as theming

Example:

```jsx
// In MyComponent.story.tsx

import MyComponent from './MyComponent';

export default {
  title: 'General/MyComponent',
  component: MyComponent,
  decorators: [ ... ],
}

```

When it comes to writing the actual stories, you should continue in the same file with named exports. The exports are turned into the story name like so:

```jsx
// Will produce a story name “some story”
export const someStory = () => <MyComponent />;
```

If you want to write cover cases with different values for props, then using knobs is usually enough. You don’t need to create a new story. This topic will be covered further down.

### Categorization

We have these categories of components:

- **Docs Overview** - Guidelines and information regarding the design system
- **Forms** - Components commonly used in forms such as different kind of inputs
- **General** - Components which can be used in a lot of different places
- **Visualizations** - Data visualizations
- **Panel** - Components belonging to panels and panel editors

## Writing MDX documentation

An MDX file is a markdown file with the possibility to add JSX. These files are used by Storybook to create a “docs” tab.

### Link the MDX file to a component’s stories

To link a component’s stories with an MDX file you have to do this:

```jsx
// In TabsBar.story.tsx

import { TabsBar } from './TabsBar';

// Import the MDX file
import mdx from './TabsBar.mdx';

export default {
  title: 'General/Tabs/TabsBar',
  component: TabsBar,
  parameters: {
    docs: {
      // This is the reference required for the MDX file
      page: mdx,
    },
  },
};
```

### MDX file structure

Use the [component docs template](./component-docs-template.mdx) for these headings, in order:

- When to use
- Never use for
- Do's and don'ts
- Usage
- Accessibility
- Props

Keep all six headings. If you have no supported guidance for **Never use for** or **Do's and don'ts**, write "No component-specific guidance documented yet." Replace that note when a relevant standard, the component's behavior, or a maintainer decision supports a recommendation. Don't turn a preference into a prohibition.

For example, the [Checkbox docs](../../packages/grafana-ui/src/components/Forms/Checkbox.mdx) illustrate two different decisions:

- **Never use for:** If users must choose exactly one of three options, use `RadioButtonGroup` instead of three checkboxes.
- **Do's and don'ts:** Write the checkbox label so checking it means "yes." Use "Hide options," not "Do not show options."

Use `ArgTypes` to generate the props table:

```jsx
import { ArgTypes } from '@storybook/addon-docs/blocks';
import { MyComponent } from './MyComponent';

<ArgTypes of={MyComponent} />;
```

#### Linking to more guidance

Give the recommendation in the component page so readers don't need to follow a link to act on it. If a longer explanation applies to just that component, place it beside the MDX with the same basename: for example, `Checkbox.mdx` and `Checkbox.guidance.md`. Don't create an empty companion.

For a choice that spans components, name the shared guide after the task, as in [inline actions](../../packages/grafana-ui/src/guidance/patterns/inline-actions.md). Link to the guide where readers make that choice. In Storybook MDX, use a full GitHub file URL for Markdown that Storybook doesn't publish; a source-relative link won't resolve there.

### MDX file without a relationship to a component

An MDX file can exist by itself without any connection to a story. This can be good for writing things such as a general guidelines page.

Two conditions must be met for this to work:

- The file needs to be named `*.story.mdx`
- A `Meta` tag must exist that says where in the hierarchy the component lives. It can look like this:

```jsx
<Meta title="Docs Overview/Color Palettes"/>

# Guidelines for using colors

...

```

You can add parameters to the `Meta` tag. This example shows how to hide the tools:

```jsx
<Meta title="Docs Overview/Color Palettes" parameters={{ options: { isToolshown: false }}}/>

# Guidelines for using colors

...

```

## Documenting component properties

A quick way to get an overview of what a component does is by looking at its properties. That's why it is important that you document these in a good way.

### Comments

When writing the props interface for a component, it's possible to add a comment to that specific property. When you do so, the comment will appear in the Props table in the MDX file. The comments are generated by [react-docgen](https://github.com/reactjs/react-docgen) and are formatted by writing `/** */`.

```jsx
interface MyProps {
  /** Sets the initial values, which are overridden when the query returns a value*/
  defaultValues: Array<T>;
}
```

### Controls

The [controls addon](https://storybook.js.org/docs/react/essentials/controls) provides a way to interact with a component's properties dynamically. It also requires much less code than knobs.

Knobs are deprecated in favor of using controls.

#### Migrating a story from Knobs to Controls

As a test, we migrated the [button story](https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/Button/Button.story.tsx).

Here's the guide on how to migrate a story to controls.

1.  Remove the `@storybook/addon-knobs` dependency.
2.  Import the `Story` type from `@storybook/react`

    `import { Story } from @storybook/react`

3.  Import the props interface from the component you're working on (these must be exported in the component):

    `import { Props } from './Component'`

4.  Add the `Story` type to all stories in the file, then replace the props sent to the component and remove any knobs:

    Before:

    ```tsx
    export const Simple = () => {
      const prop1 = text('Prop1', 'Example text');
      const prop2 = select('Prop2', ['option1', 'option2'], 'option1');

      return <Component prop1={prop1} prop2={prop2} />;
    };
    ```

    After:

    ```tsx
    export const Simple: Story<Props> = ({ prop1, prop2 }) => {
      return <Component prop1={prop1} prop2={prop2} />;
    };
    ```

5.  Add default props (or `args` in Storybook language):

    ```tsx
    Simple.args = {
      prop1: 'Example text',
      prop2: 'option 1',
    };
    ```

6.  If the component has advanced props type (that is, other than string, number, or Boolean), you need to specify these in an `argTypes`. Do this in the default export of the story:

    ```tsx
    export default {
      title: 'Component/Component',
      component: Component,
      argTypes: {
        prop2: { control: { type: 'select', options: ['option1', 'option2'] } },
      },
    };
    ```

## Best practices

- When creating a new component or writing documentation for an existing one, add a code example. The example should always cover the basic use case it was intended for.
- Use stories and knobs to create edge cases. If you are trying to solve a bug, try to reproduce it with a story.
- Do not create stories in the MDX. Instead, create them in the `*.story.tsx` file.
