import {
  FieldConfigEditorRegistry,
  FieldConfigSource,
  GrafanaPlugin,
  PanelEditorProps,
  PanelMigrationHandler,
  PanelOptionEditorsRegistry,
  PanelPluginMeta,
  PanelProps,
  PanelTypeChangedHandler,
} from '../types';
import { FieldConfigEditorBuilder, PanelOptionsEditorBuilder } from '../utils/OptionsUIBuilders';
import { ComponentClass, ComponentType } from 'react';

export class PanelPlugin<TOptions = any> extends GrafanaPlugin<PanelPluginMeta> {
  private customFieldConfigsUIBuilder = new FieldConfigEditorBuilder();
  private _customFieldConfigs?: FieldConfigEditorRegistry;
  private registerCustomFieldConfigs?: (builder: FieldConfigEditorBuilder) => void;

  private optionsUIBuilder = new PanelOptionsEditorBuilder();
  private _optionEditors?: PanelOptionEditorsRegistry;
  private registerOptionEditors?: (builder: PanelOptionsEditorBuilder) => void;

  panel: ComponentType<PanelProps<TOptions>>;
  editor?: ComponentClass<PanelEditorProps<TOptions>>;
  defaults?: TOptions;
  fieldConfigDefaults?: FieldConfigSource = {
    defaults: {},
    overrides: [],
  };
  onPanelMigration?: PanelMigrationHandler<TOptions>;
  onPanelTypeChanged?: PanelTypeChangedHandler<TOptions>;
  noPadding?: boolean;

  /**
   * Legacy angular ctrl.  If this exists it will be used instead of the panel
   */
  angularPanelCtrl?: any;

  constructor(panel: ComponentType<PanelProps<TOptions>>) {
    super();
    this.panel = panel;
  }

  get customFieldConfigs() {
    if (!this._customFieldConfigs && this.registerCustomFieldConfigs) {
      this.registerCustomFieldConfigs(this.customFieldConfigsUIBuilder);
      this._customFieldConfigs = this.customFieldConfigsUIBuilder.getRegistry();
    }

    return this._customFieldConfigs;
  }

  get optionEditors() {
    if (!this._optionEditors && this.registerOptionEditors) {
      this.registerOptionEditors(this.optionsUIBuilder);
      this._optionEditors = this.optionsUIBuilder.getRegistry();
    }

    return this._optionEditors;
  }

  setEditor(editor: ComponentClass<PanelEditorProps<TOptions>>) {
    this.editor = editor;
    return this;
  }

  setDefaults(defaults: TOptions) {
    this.defaults = defaults;
    return this;
  }

  setNoPadding() {
    this.noPadding = true;
    return this;
  }

  /**
   * This function is called before the panel first loads if
   * the current version is different than the version that was saved.
   *
   * This is a good place to support any changes to the options model
   */
  setMigrationHandler(handler: PanelMigrationHandler) {
    this.onPanelMigration = handler;
    return this;
  }

  /**
   * This function is called when the visualization was changed. This
   * passes in the panel model for previous visualisation options inspection
   * and panel model updates.
   *
   * This is useful for supporting PanelModel API updates when changing
   * between Angular and React panels.
   */
  setPanelChangeHandler(handler: PanelTypeChangedHandler) {
    this.onPanelTypeChanged = handler;
    return this;
  }

  /**
   * Enables custom field properties editor creation
   *
   * @example
   * ```typescript
   *
   * import { ShapePanel } from './ShapePanel';
   *
   * interface ShapePanelOptions {}
   *
   * export const plugin = new PanelPlugin<ShapePanelOptions>(ShapePanel)
   *   .setCustomFieldConfigEditor(builder => {
   *     builder
   *       .addNumberInput({
   *         id: 'shapeBorderWidth',
   *         name: 'Border width',
   *         description: 'Border width of the shape',
   *         settings: {
   *           min: 1,
   *           max: 5,
   *         },
   *       })
   *       .addSelect({
   *         id: 'displayMode',
   *         name: 'Display mode',
   *         description: 'How the shape shout be rendered'
   *         settings: {
   *           options: [{value: 'fill', label: 'Fill' }, {value: 'transparent', label: 'Transparent }]
   *         },
   *       })
   *   })
   * ```
   *
   * @public
   **/
  setCustomFieldConfigEditor(builder: (builder: FieldConfigEditorBuilder) => void) {
    // builder is applied lazily when custom field configs are accessed
    this.registerCustomFieldConfigs = builder;
    return this;
  }

  /**
   * Enables panel options editor creation
   *
   * @example
   * ```typescript
   *
   * import { ShapePanel } from './ShapePanel';
   *
   * interface ShapePanelOptions {}
   *
   * export const plugin = new PanelPlugin<ShapePanelOptions>(ShapePanel)
   *   .setOptionsEditor(builder => {
   *     builder
   *       .addSelect({
   *         id: 'shape',
   *         name: 'Shape',
   *         description: 'Select shape to render'
   *         settings: {
   *           options: [
   *             {value: 'circle', label: 'Circle' },
   *             {value: 'square', label: 'Square },
   *             {value: 'triangle', label: 'Triangle }
   *            ]
   *         },
   *       })
   *   })
   * ```
   *
   * @public
   **/
  setOptionsEditor(builder: (builder: PanelOptionsEditorBuilder) => void) {
    // builder is applied lazily when options UI is created
    this.registerOptionEditors = builder;
    return this;
  }

  /**
   * Enables configuration of panel's default field config
   */
  setFieldConfigDefaults(defaultConfig: Partial<FieldConfigSource>) {
    this.fieldConfigDefaults = {
      defaults: {},
      overrides: [],
      ...defaultConfig,
    };

    return this;
  }
}
