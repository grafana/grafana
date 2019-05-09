import {
  OptionsUIModel,
  OptionsGroup,
  OptionsUIType,
  OptionsGrid,
  OptionEditor,
  AbstractOptionUIModel,
} from '../../types/panelOptions';
import { PanelOptionsGroup } from '../PanelOptionsGroup/PanelOptionsGroup';
import { Omit } from '../../types/utils';

type GroupConfig<TConfig> = TConfig & {
  component?: React.ComponentType<Omit<TConfig, 'component'>>;
};

type GroupAdder = (config: GroupConfig<any>) => OptionsGroupUIBuilder<any, any>;

interface UIModelBuilder<TModel> {
  getUIModel(): TModel;
}

interface OptionsGroupUIBuilderContext extends UIModelBuilder<any> {
  addGroup: GroupAdder;
  addEditor: (config: EditorConfig) => OptionsGroupUIBuilderContext;
  endGroup: () => OptionsGroupUIBuilderContext;
}

type EditorConfig = AbstractOptionUIModel<any, any>;

class OptionEditorUIBuilder implements UIModelBuilder<OptionEditor<any, any>> {
  private model: EditorConfig;

  constructor(config: EditorConfig) {
    this.model = config;
  }

  getUIModel = () => {
    return {
      type: OptionsUIType.Editor as OptionsUIType.Editor, // TODO: how to fix this,
      editor: this.model,
    };
  };
}

class OptionsGroupUIBuilder<TConfig, TContext>
  implements OptionsGroupUIBuilderContext, UIModelBuilder<OptionsGroup<TConfig>> {
  private groupContent: Array<UIModelBuilder<OptionEditor<any, any> | OptionsGroup<any>>> = [];
  private config: TConfig;
  private component: React.ComponentType<TConfig>;

  private ctx: any;

  constructor(ctx: TContext, config: TConfig, component?: React.ComponentType<TConfig>) {
    this.ctx = ctx;
    this.config = config;
    // @ts-ignore
    this.component = component || PanelOptionsGroup;
  }

  addGroup = ({ component, ...rest }: GroupConfig<any>): OptionsGroupUIBuilder<any, OptionsGroupUIBuilderContext> => {
    const group = new OptionsGroupUIBuilder(this.ctx, rest, component);
    this.groupContent.push(group);
    return group;
  };

  addEditor = (config: EditorConfig) => {
    const editor: OptionEditorUIBuilder = new OptionEditorUIBuilder(config);
    this.groupContent.push(editor);
    return this;
  };

  endGroup = (): OptionsGroupUIBuilderContext & TContext => {
    return {
      ...this.ctx,
      addGroup: this.addGroup,
      addEditor: this.addEditor,
      endGroup: this.endGroup,
    };
  };

  getUIModel() {
    return {
      type: OptionsUIType.Group as OptionsUIType.Group, // TODO: how to fix this
      content: this.groupContent ? this.groupContent.map(c => c.getUIModel()) : [],
      component: this.component,
      config: this.config,
    };
  }
}

export class OptionsUIBuilder<TOptions> implements UIModelBuilder<OptionsUIModel<TOptions>> {
  private model?: UIModelBuilder<OptionsGroup<any> | OptionEditor<TOptions, any>>;

  addGroup(config: GroupConfig<any>) {
    const { component, ...rest } = config;
    const group = new OptionsGroupUIBuilder(this, rest, component);
    this.model = group;

    return group;
  }

  addEditor = (config: EditorConfig) => {
    const editor: OptionEditorUIBuilder = new OptionEditorUIBuilder(config);
    this.model = editor;
    return this;
  };

  getUIModel = () => {
    debugger;
    if (this.model) {
      return {
        model: this.model.getUIModel(),
      };
    }

    return {
      model: {} as any, // TODO: blah, is there a better wat?
    };
  };
}

// const tmp = new OptionsUIBuilder<{a: string}>();
// const tmp1: React.FunctionComponent<{title: number}> = () => {
//   return null;
// }

// tmp
//   .useGroup({
//     title: 1,
//     component: tmp1
//   })
//     .addGroup({
//       title: 'as',
//       component: tmp1
//     }).endGroup().
