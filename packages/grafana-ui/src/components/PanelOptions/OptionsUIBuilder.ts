import { OptionsGroup, OptionsUIType, OptionEditor, OptionUIComponentProps } from '../../types/panelOptions';
import { Omit, Subtract } from '../../types/utils';
import React from 'react';
import { BooleanOption } from './BooleanOption';
import { IntegerOption } from './NumericInputOption';
import { FieldDisplayOptions } from '../../utils/index';
import { FieldDisplayEditor, FieldPropertiesEditor } from '../SingleStatShared/index';
import { Threshold } from '../../types/index';
import { ThresholdsEditor } from '../ThresholdsEditor/ThresholdsEditor';

type GroupConfig<TConfig> = TConfig & {
  component?: React.ComponentType<Omit<TConfig, 'component'>>;
};

interface UIModelBuilder<TModel> {
  getUIModel(): TModel;
}

interface EditorOptions<TProps> {
  label?: string;
  placeholder?: string;
  description?: string;
  properties?: TProps;
}

interface EditorConfig<TValueType extends {}, TProps>
  extends EditorOptions<Subtract<TProps, OptionUIComponentProps<TValueType>>> {
  propertyPath: string;
  component: React.ComponentType<TProps>;
}

type SimplifiedEditorConfig<TValueType extends {}, TProps> = Omit<EditorConfig<TValueType, TProps>, 'propertyPath'>;

type InferOptionType<TOptions extends object, TKey extends keyof TOptions> = TOptions[TKey];
type KeysMatching<T, V> = { [K in keyof T]: T[K] extends V ? K : never }[keyof T];
class OptionEditorUIBuilder implements UIModelBuilder<OptionEditor<any, any>> {
  private model: EditorConfig<any, any>;

  constructor(config: EditorConfig<any, any>) {
    this.model = config;
  }

  getUIModel = () => {
    return {
      type: OptionsUIType.Editor as OptionsUIType.Editor, // TODO: how to fix this,
      editor: this.model as any,
    };
  };
}

export class OptionsGroupUIBuilder<
  TOptions extends {},
  TContext = undefined,
  TPContext = undefined,
  TConfig extends {} = {}
> implements UIModelBuilder<OptionsGroup<any>> {
  private groupContent: Array<UIModelBuilder<OptionEditor<any, any> | OptionsGroup<any>>> = [];
  private config: TConfig | null;
  private component: React.ComponentType<TConfig>;
  private ctx?: OptionsGroupUIBuilder<TContext, any, any, any>;
  private path?: string;

  constructor(
    ctx?: OptionsGroupUIBuilder<any, any>,
    config?: TConfig,
    component?: React.ComponentType<TConfig>,
    path?: string
  ) {
    this.ctx = ctx;
    this.config = config || null;
    // @ts-ignore
    this.component = component;
    this.path = path || (this.ctx && this.ctx.path);
  }

  addGroup = ({
    component,
    ...rest
  }: GroupConfig<any>): OptionsGroupUIBuilder<TOptions, TContext, TPContext, TConfig> => {
    const group = new OptionsGroupUIBuilder(this, rest, component);
    this.groupContent.push(group);
    return group as any;
  };

  addNestedOptionsGroup = <T extends keyof TOptions, KConfig>(
    property: T,
    { component, ...rest }: GroupConfig<any>
  ): OptionsGroupUIBuilder<TOptions[T], TOptions> => {
    const group = new OptionsGroupUIBuilder<TOptions[T], TOptions, TContext>(this, rest, component, property);
    this.groupContent.push(group);
    return group as any;
  };

  addOptionEditor = <T extends keyof TOptions, TProps>(
    property: T,
    config: SimplifiedEditorConfig<InferOptionType<TOptions, T>, TProps>
  ) => {
    const editor: OptionEditorUIBuilder = new OptionEditorUIBuilder({
      ...config,
      propertyPath: this.path ? `${this.path}.${property}` : (property as string),
    });
    this.groupContent.push(editor);
    return this;
  };

  addBooleanEditor = <T extends keyof TOptions>(property: KeysMatching<TOptions, boolean>, config?: EditorOptions) => {
    return this.addOptionEditor(property, {
      component: BooleanOption as any,
      ...config,
    });
  };

  addIntegerEditor = <T extends keyof TOptions>(property: KeysMatching<TOptions, number>, config?: EditorOptions) => {
    return this.addOptionEditor(property, {
      component: IntegerOption as any,
      ...config,
    });
  };

  addFieldDisplayEditor = <T extends keyof TOptions>(
    property: KeysMatching<TOptions, FieldDisplayOptions>,
    config?: EditorOptions<any> // TODO: type aditiona props
  ) => {
    return this.addOptionEditor(property, {
      component: FieldDisplayEditor as any,
      ...config,
    });
  };

  addFieldPropertiesEditor = <T extends keyof TOptions>(
    property: KeysMatching<TOptions, FieldDisplayOptions>,
    config?: EditorOptions<any> // TODO: type aditiona props
  ) => {
    return this.addOptionEditor(property, {
      component: FieldPropertiesEditor as any,
      ...config,
    });
  };

  addThresholdsEditor = <T extends keyof TOptions>(
    property: KeysMatching<TOptions, Threshold[]>,
    config?: EditorOptions<any> // TODO: type aditiona props
  ) => {
    return this.addOptionEditor(property, {
      component: ThresholdsEditor as any,
      ...config,
    });
  };

  endGroup = (): OptionsGroupUIBuilder<TContext, TPContext extends null | undefined ? TContext : TPContext, any> => {
    if (this.ctx) {
      return this.ctx;
    }

    return this;
  };

  getUIModel() {
    const model = {
      type: OptionsUIType.Group as OptionsUIType.Group, // TODO: how to fix this
      content: this.groupContent ? this.groupContent.map(c => c.getUIModel()) : [],
      component: this.component,
      config: this.config || ({} as TConfig),
    };

    return model;
  }
}
