---
title: Build a custom panel option editor
aliases:
  - ../../../plugins/custom-panel-option-editors/
description: How to build a custom panel option editor.
keywords:
  - grafana
  - plugins
  - plugin
  - custom panel option editor
  - customizing panel options
  - panel options
weight: 700
---

# Build a custom panel option editor

The Grafana plugin platform comes with a range of editors that allow your users to customize a panel. The standard editors cover the most common types of options, such as text input and boolean switches. If you don't find the editor you're looking for, you can build your own.

## Panel option editor basics

The simplest editor is a React component that accepts two props:

- **`value`**: the current value of the option
- **`onChange`**: updates the option's value

The editor in the example below lets the user toggle a boolean value by clicking a button:

**SimpleEditor.tsx**

```ts
import React from 'react';
import { Button } from '@grafana/ui';
import { StandardEditorProps } from '@grafana/data';

export const SimpleEditor = ({ value, onChange }: StandardEditorProps<boolean>) => {
  return <Button onClick={() => onChange(!value)}>{value ? 'Disable' : 'Enable'}</Button>;
};
```

To use a custom panel option editor, use the `addCustomEditor` on the `OptionsUIBuilder` object in your `module.ts` file and set the `editor` property to the name of your custom editor component.

**module.ts**

```ts
export const plugin = new PanelPlugin<SimpleOptions>(SimplePanel).setPanelOptions((builder) => {
  return builder.addCustomEditor({
    id: 'label',
    path: 'label',
    name: 'Label',
    editor: SimpleEditor,
  });
});
```

## Add settings to your panel option editor

You can use your custom editor to customize multiple possible settings. To add settings to your editor, set the second template variable of `StandardEditorProps` to an interface that contains the settings you want to configure. Access the editor settings through the `item` prop.

Here's an example of an editor that populates a drop-down with a range of numbers. The `Settings` interface defines the range of the `from` and `to` properties.

**SimpleEditor.tsx**

```ts
interface Settings {
  from: number;
  to: number;
}

type Props = StandardEditorProps<number, Settings>;

export const SimpleEditor = ({ item, value, onChange }: Props) => {
  const options: Array<SelectableValue<number>> = [];

  // Default values
  const from = item.settings?.from ?? 1;
  const to = item.settings?.to ?? 10;

  for (let i = from; i <= to; i++) {
    options.push({
      label: i.toString(),
      value: i,
    });
  }

  return <Select options={options} value={value} onChange={(selectableValue) => onChange(selectableValue.value)} />;
};
```

You can now configure the editor for each option by configuring the `settings` property to call `addCustomEditor`:

```ts
export const plugin = new PanelPlugin<SimpleOptions>(SimplePanel).setPanelOptions((builder) => {
  return builder.addCustomEditor({
    id: 'index',
    path: 'index',
    name: 'Index',
    editor: SimpleEditor,
    settings: {
      from: 1,
      to: 10,
    },
  });
});
```

## Use query results in your panel option editor

Option editors can access the results from the last query. This lets you update your editor dynamically based on the data returned by the data source.

The editor context is available through the `context` prop. The data frames returned by the data source are available under `context.data`.

**SimpleEditor.tsx**

```ts
export const SimpleEditor = ({ item, value, onChange, context }: StandardEditorProps<string>) => {
  const options: SelectableValue<string>[] = [];

  if (context.data) {
    const frames = context.data;

    for (let i = 0; i < frames.length; i++) {
      options.push({
        label: frames[i].name,
        value: frames[i].name,
      });
    }
  }

  return <Select options={options} value={value} onChange={(selectableValue) => onChange(selectableValue.value)} />;
};
```
