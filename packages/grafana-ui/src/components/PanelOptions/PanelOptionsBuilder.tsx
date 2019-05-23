import React from 'react';
import {
  OptionsUIType,
  OptionsUIModel,
  OptionsGroup as OptionsGroupUI,
  OptionEditor as OptionEditorUI,
  OptionsUI,
  OptionInputAPI,
  isGroupUIModel,
} from '../../types/panelOptions';
import get from 'lodash/get';
import * as yup from 'yup';

type OptionChangeHandler<TOptions> = <K extends keyof TOptions>(key: K | string, value: TOptions[K]) => void;

interface PanelOptionsBilderProps<TOptions extends {}> {
  optionsSchema: yup.ObjectSchema<TOptions>;
  uiModel: OptionsUIModel<TOptions>;
  options: TOptions;
  onOptionsChange: OptionChangeHandler<TOptions>;
}

type Diff<T extends string, U extends string> = ({ [P in T]: P } & { [P in U]: never } & { [x: string]: never })[T];
// @ts-ignore
type Omit<T, K extends keyof T> = Pick<T, Diff<keyof T, K>>;

// function isOptionRequired<TOptions extends {}>(property: string, schema: yup.ObjectSchema<TOptions>) {
//   return (
//     yup
//       .reach(schema, property)
//       .describe()
//       .tests.filter(t => t.name === 'required').length > 0
//   );
// }

interface OptionEditorProps<TOptions extends {}, TKey extends keyof TOptions>
  extends Omit<OptionEditorUI<TOptions, TKey>, keyof OptionsUI<any>>,
    OptionInputAPI<TOptions[TKey]> {
  optionsSchema: yup.ObjectSchema<TOptions>;
}

const OptionEditor = ({ editor, value, onChange, optionsSchema }: OptionEditorProps<any, any>) => {
  const {component} = editor;
  if (!component) {
    // TODO: handle default editors based on option schema
    return null;
  }
  return React.createElement(component, {
    value,
    onChange,
    ...editor.props
    // properties: {
    //   required: isOptionRequired(propertyPath, optionsSchema),
    //   label: editor.label,
    // },
  });
};

interface OptionsGroupProps<TOptions extends {}> extends Omit<OptionsGroupUI<any>, keyof OptionsUI<any>> {
  onOptionsChange: OptionChangeHandler<TOptions>;
  options: TOptions;
  optionsSchema: yup.ObjectSchema<TOptions>;
}

const OptionsGroup = ({
  component,
  content,
  config,
  options,
  onOptionsChange,
  optionsSchema,
}: OptionsGroupProps<any>) => {
  return React.createElement(component || React.Fragment, {
    ...config,
    children: content.map(c => {
      if (isGroupUIModel(c)) {
        console.log('group');
        return (
          <OptionsGroup
            component={c.component}
            config={c.config}
            content={c.content}
            onOptionsChange={onOptionsChange}
            options={options}
            optionsSchema={optionsSchema}
          />
        );
      }
      return (
        <OptionEditor
          editor={c.editor}
          value={get(options, c.editor.propertyPath)}
          onChange={(value: any) => {
            onOptionsChange(c.editor.propertyPath, value);
          }}
          optionsSchema={optionsSchema}
        />
      );
    }),
  });
};

interface OptionsUIElementProps<TOptions extends {}> {
  options: TOptions;
  optionsSchema: yup.ObjectSchema<TOptions>;
  onOptionsChange: OptionChangeHandler<TOptions>;
  uiElement: OptionEditorUI<TOptions, keyof TOptions> | OptionsGroupUI<TOptions>;
}

function OptionsUIElement<TOptions>({
  uiElement,
  options,
  onOptionsChange,
  optionsSchema,
}: OptionsUIElementProps<TOptions>) {
  switch (uiElement.type) {
    case OptionsUIType.Group:
      return (
        <OptionsGroup
          config={uiElement.config}
          content={uiElement.content}
          component={uiElement.component}
          options={options}
          onOptionsChange={onOptionsChange}
          optionsSchema={optionsSchema}
        />
      );
    case OptionsUIType.Editor:
      return (
        <OptionEditor
          optionsSchema={optionsSchema}
          editor={uiElement.editor}
          value={get(options, uiElement.editor.propertyPath)}
          onChange={value => {
            onOptionsChange(uiElement.editor.propertyPath, value);
          }}
        />
      );
  }
}

export function PanelOptionsUIBuilder<TOptions extends { [key: string]: any }>(
  props: PanelOptionsBilderProps<TOptions>
) {
  const { uiModel, options, optionsSchema, onOptionsChange } = props;

  return (
    <OptionsUIElement
      uiElement={uiModel.model}
      options={options}
      onOptionsChange={onOptionsChange}
      optionsSchema={optionsSchema}
    />
  );
}
