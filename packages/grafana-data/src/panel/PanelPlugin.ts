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
  FieldConfigProperty,
  ThresholdsMode,
} from '../types';
import { FieldConfigEditorBuilder, PanelOptionsEditorBuilder } from '../utils/OptionsUIBuilders';
import { ComponentClass, ComponentType } from 'react';
import set from 'lodash/set';
import { deprecationWarning } from '../utils';

export const allStandardFieldConfigProperties: FieldConfigProperty[] = [
  FieldConfigProperty.Min,
  FieldConfigProperty.Max,
  FieldConfigProperty.Title,
  FieldConfigProperty.Unit,
  FieldConfigProperty.Decimals,
  FieldConfigProperty.NoValue,
  FieldConfigProperty.Color,
  FieldConfigProperty.Thresholds,
  FieldConfigProperty.Mappings,
  FieldConfigProperty.Links,
];

export const standardFieldConfigDefaults: Partial<Record<FieldConfigProperty, any>> = {
  [FieldConfigProperty.Thresholds]: {
    mode: ThresholdsMode.Absolute,
    steps: [
      { value: -Infinity, color: 'green' },
      { value: 80, color: 'red' },
    ],
  },
  [FieldConfigProperty.Mappings]: [],
};

export const standardFieldConfigProperties = new Map(allStandardFieldConfigProperties.map(p => [p, undefined]));

export class PanelPlugin<TOptions = any, TFieldConfigOptions extends object = any> extends GrafanaPlugin<
  PanelPluginMeta
> {
  private _defaults?: TOptions;
  private _standardFieldConfigProperties?: Map<FieldConfigProperty, any>;

  private _fieldConfigDefaults: FieldConfigSource<TFieldConfigOptions> = {
    defaults: {},
    overrides: [],
  };
  private _customFieldConfigs?: FieldConfigEditorRegistry;
  private customFieldConfigsUIBuilder = new FieldConfigEditorBuilder<TFieldConfigOptions>();
  private registerCustomFieldConfigs?: (builder: FieldConfigEditorBuilder<TFieldConfigOptions>) => void;

  private _optionEditors?: PanelOptionEditorsRegistry;
  private optionsUIBuilder = new PanelOptionsEditorBuilder<TOptions>();
  private registerOptionEditors?: (builder: PanelOptionsEditorBuilder<TOptions>) => void;

  panel: ComponentType<PanelProps<TOptions>>;
  editor?: ComponentClass<PanelEditorProps<TOptions>>;
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

  get defaults() {
    let result = this._defaults || {};

    if (!this._defaults) {
      const editors = this.optionEditors;

      if (!editors || editors.list().length === 0) {
        return null;
      }

      for (const editor of editors.list()) {
        set(result, editor.id, editor.defaultValue);
      }
    }
    return result;
  }

  get fieldConfigDefaults(): FieldConfigSource<TFieldConfigOptions> {
    let customPropertiesDefaults = this._fieldConfigDefaults.defaults.custom;

    if (!customPropertiesDefaults) {
      customPropertiesDefaults = {} as TFieldConfigOptions;
    }
    const editors = this.customFieldConfigs;

    if (editors && editors.list().length !== 0) {
      for (const editor of editors.list()) {
        set(customPropertiesDefaults, editor.id, editor.defaultValue);
      }
    }

    return {
      defaults: {
        ...(this._standardFieldConfigProperties ? Object.fromEntries(this._standardFieldConfigProperties) : {}),
        custom:
          Object.keys(customPropertiesDefaults).length > 0
            ? {
                ...customPropertiesDefaults,
              }
            : undefined,
        ...this._fieldConfigDefaults.defaults,
      },
      // TODO: not sure yet what about overrides, if anything
      overrides: this._fieldConfigDefaults.overrides,
    };
  }

  get standardFieldConfigProperties() {
    return this._standardFieldConfigProperties ? Array.from(this._standardFieldConfigProperties.keys()) : [];
  }

  /**
   * @deprecated setDefaults is deprecated in favor of setPanelOptions
   */
  setDefaults(defaults: TOptions) {
    deprecationWarning('PanelPlugin', 'setDefaults', 'setPanelOptions');
    this._defaults = defaults;
    return this;
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
   *   .setCustomFieldOptions(builder => {
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
  setCustomFieldOptions(builder: (builder: FieldConfigEditorBuilder<TFieldConfigOptions>) => void) {
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
   *   .setPanelOptions(builder => {
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
  setPanelOptions(builder: (builder: PanelOptionsEditorBuilder<TOptions>) => void) {
    // builder is applied lazily when options UI is created
    this.registerOptionEditors = builder;
    return this;
  }

  /**
   * Allows specyfing which standard field config options panel should use and defining default values
   *
   * @example
   * ```typescript
   *
   * import { ShapePanel } from './ShapePanel';
   *
   * interface ShapePanelOptions {}
   *
   * // when plugin should use all standard options
   * export const plugin = new PanelPlugin<ShapePanelOptions>(ShapePanel)
   *  .useStandardFieldConfig();
   *
   * // when plugin should only display specific standard options
   * // note, that options will be displayed in the order they are provided
   * export const plugin = new PanelPlugin<ShapePanelOptions>(ShapePanel)
   *  .useStandardFieldConfig([FieldConfigProperty.Min, FieldConfigProperty.Max, FieldConfigProperty.Links]);
   *
   * // when standard option's default value needs to be provided
   * export const plugin = new PanelPlugin<ShapePanelOptions>(ShapePanel)
   *  .useStandardFieldConfig([FieldConfigProperty.Min, FieldConfigProperty.Max], {
   *    [FieldConfigProperty.Min]: 20,
   *    [FieldConfigProperty.Max]: 100
   *  });
   *
   * ```
   *
   * @public
   */
  useStandardFieldConfig(
    properties?: FieldConfigProperty[] | null,
    customDefaults?: Partial<Record<FieldConfigProperty, any>>
  ) {
    if (!properties) {
      this._standardFieldConfigProperties = standardFieldConfigProperties;
      return this;
    } else {
      this._standardFieldConfigProperties = new Map(properties.map(p => [p, standardFieldConfigProperties.get(p)]));
    }

    const defaults = customDefaults ?? standardFieldConfigDefaults;

    if (defaults) {
      Object.keys(defaults).map(k => {
        if (properties.indexOf(k as FieldConfigProperty) > -1) {
          this._standardFieldConfigProperties!.set(k as FieldConfigProperty, defaults[k as FieldConfigProperty]);
        }
      });
    }
    return this;
  }
}
