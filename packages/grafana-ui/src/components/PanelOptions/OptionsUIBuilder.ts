import {
  OptionsGroup,
  OptionsUIType,
  OptionEditor,
  OptionUIComponentProps,
  OptionInputAPI,
} from '../../types/panelOptions';
import { Omit, Subtract } from '../../types/utils';
import React from 'react';
import { BooleanOption, BooleanOptionProps } from './BooleanOption';
import { Threshold, KeyValue } from '../../types/index';
import { ThresholdsEditor } from '../ThresholdsEditor/ThresholdsEditor';
import { PanelOptionsGrid } from '../PanelOptionsGrid/PanelOptionsGrid';
import { PanelOptionsGroup } from '../PanelOptionsGroup/PanelOptionsGroup';

interface UIModelBuilder<TModel> {
  getUIModel(): TModel;
}

type GroupConfig<TConfig> = TConfig & {
  component?: React.ComponentType<Omit<TConfig, 'component'>>;
};

interface EditorConfig<TValueType extends {}, TProps extends OptionInputAPI<TValueType>> {
  propertyPath: string;
  component: React.ComponentType<TProps>;
  props: Subtract<TProps, OptionUIComponentProps<TValueType>>;
}
type PredefinedOptionEditorConfig<TProps extends OptionInputAPI<any>> = Subtract<TProps, OptionUIComponentProps<any>>;
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
  TOptions extends KeyValue,
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

  addGroup = <TGroupConfig>({
    component,
    ...rest
  }: GroupConfig<TGroupConfig>): OptionsGroupUIBuilder<TOptions, TContext, TPContext, TConfig> => {
    const group = new OptionsGroupUIBuilder(this as any, rest, component);
    this.groupContent.push(group);
    return group as any;
  };

  addScopedOptions = <T extends keyof TOptions>(
    property: T,
    { component, ...rest }: GroupConfig<any>
  ): OptionsGroupUIBuilder<TOptions[T], TOptions, TContext extends null | undefined ? TOptions : TContext> => {
    const group = new OptionsGroupUIBuilder<TOptions[T], TOptions, TContext>(
      this as any,
      rest,
      component,
      property as string
    );
    this.groupContent.push(group);
    return group as any;
  };

  addOptionEditor = <T extends keyof TOptions, TProps extends OptionInputAPI<TOptions[T]>>(
    property: T,
    component: React.ComponentType<TProps>,
    config?: Subtract<TProps, OptionUIComponentProps<InferOptionType<TOptions, T>>>
  ) => {
    const editor: OptionEditorUIBuilder = new OptionEditorUIBuilder({
      component,
      propertyPath: this.path ? `${this.path}.${property}` : (property as string),
      props: config,
    });
    this.groupContent.push(editor);
    return this;
  };

  addBooleanEditor = (
    property: KeysMatching<TOptions, boolean>,
    config?: PredefinedOptionEditorConfig<BooleanOptionProps>
  ) => {
    return this.addOptionEditor(property, BooleanOption as any, config);
  };

  addPanelOptionsGrid = (cols?: number) => {
    return this.addGroup<{ cols?: number }>({
      component: PanelOptionsGrid,
      cols,
    });
  };

  addPanelOptionsGroup = (title?: string) => {
    return this.addGroup<{
      title?: string;
    }>({
      component: PanelOptionsGroup,
      title,
    });
  };

  addThresholdsEditor = <T extends keyof TOptions>(property: KeysMatching<TOptions, Threshold[]>) => {
    return this.addOptionEditor(property, ThresholdsEditor as any);
  };

  endGroup = (): OptionsGroupUIBuilder<
    TContext extends null | undefined ? TOptions : TContext,
    TPContext extends null | undefined ? TContext : TPContext,
    TPContext
  > => {
    if (this.ctx) {
      return this.ctx as any;
    }

    return this as any;
  };

  getUIModel() {
    const model = {
      type: OptionsUIType.Group as OptionsUIType.Group,
      content: this.groupContent ? this.groupContent.map(c => c.getUIModel()) : [],
      component: this.component,
      config: this.config || ({} as TConfig),
    };

    return model;
  }
}
