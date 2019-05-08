import React from 'react';
import {
  OptionsUIType,
  OptionsUIModel,
  OptionsGrid as OptionsGridUI,
  OptionsGroup as OptionsGroupUI,
  OptionEditor as OptionEditorUI,
  OptionsUI,
  OptionInputAPI,
  isGroupUIModel,
} from '../../types/panelOptions';
import { css } from 'emotion';
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

function isOptionRequired<TOptions extends {}>(property: string, schema: yup.ObjectSchema<TOptions>) {
  return (
    yup
      .reach(schema, property)
      .describe()
      .tests.filter(t => t.name === 'required').length > 0
  );
}

type OptionsGridItemRenderer = (
  item: OptionsGridUI | OptionsGroupUI<any> | OptionEditorUI<any, any>
) => JSX.Element | null | undefined;
interface OptionsGridProps extends Omit<OptionsGridUI, keyof OptionsUI<any>> {
  renderGridItem: OptionsGridItemRenderer;
}

const OptionsGrid = ({ config, content, renderGridItem }: OptionsGridProps) => {
  return (
    <div
      className={css`
        display: grid;
        grid-template-columns: repeat(${config.columns}, 1fr);
        grid-row-gap: 10px;
        grid-column-gap: 10px;
      `}
    >
      {content.map(item => renderGridItem(item))}
    </div>
  );
};

interface OptionEditorProps<TOptions extends {}, TKey extends keyof TOptions>
  extends Omit<OptionEditorUI<TOptions, TKey>, keyof OptionsUI<any>>,
    OptionInputAPI<TOptions[TKey]> {
  optionsSchema: yup.ObjectSchema<TOptions>;
  onChange: (value: TOptions[TKey]) => void;
}

const OptionEditor = ({ editor, value, onChange, optionsSchema }: OptionEditorProps<any, any>) => {
  if (!editor.component) {
    // TODO: handle default editors based on option schema
    return null;
  }
  return React.createElement(editor.component, {
    value,
    onChange,
    properties: {
      required: isOptionRequired(editor.property, optionsSchema),
      label: editor.label,
    },
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
  if (!component) {
    return null;
  }

  return React.createElement(component || 'div', {
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
          value={get(options, c.editor.property)}
          onChange={(value: any) => {
            onOptionsChange(c.editor.property, value);
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
          value={get(options, uiElement.editor.property)}
          onChange={value => {
            onOptionsChange(uiElement.editor.property, value);
          }}
        />
      );
  }
}
export function PanelOptionsUIBuilder<TOptions extends { [key: string]: any }>(
  props: PanelOptionsBilderProps<TOptions>
) {
  const { uiModel, options, optionsSchema, onOptionsChange } = props;

  const gridItemRenderer: OptionsGridItemRenderer = item =>
    item.type === OptionsUIType.Layout ? (
      <OptionsGrid config={item.config} content={item.content} renderGridItem={gridItemRenderer} />
    ) : (
      <OptionsUIElement
        uiElement={item}
        options={options}
        onOptionsChange={onOptionsChange}
        optionsSchema={optionsSchema}
      />
    );

  switch (uiModel.model.type) {
    case OptionsUIType.Layout:
      return (
        <OptionsGrid config={uiModel.model.config} renderGridItem={gridItemRenderer} content={uiModel.model.content} />
      );
    default:
      return (
        <OptionsUIElement
          uiElement={uiModel.model}
          options={options}
          onOptionsChange={onOptionsChange}
          optionsSchema={optionsSchema}
        />
      );
  }
}
