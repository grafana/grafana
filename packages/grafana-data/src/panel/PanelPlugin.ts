import { set } from 'lodash';
import { ComponentClass, ComponentType } from 'react';

import { FieldConfigOptionsRegistry } from '../field/FieldConfigOptionsRegistry';
import { StandardEditorContext } from '../field/standardFieldConfigEditorRegistry';
import { FieldConfigProperty, FieldConfigSource } from '../types/fieldOverrides';
import {
  PanelPluginMeta,
  VisualizationSuggestionsSupplier,
  PanelProps,
  PanelEditorProps,
  PanelMigrationHandler,
  PanelTypeChangedHandler,
  PanelPluginDataSupport,
} from '../types/panel';
import { GrafanaPlugin } from '../types/plugin';
import { FieldConfigEditorBuilder, PanelOptionsEditorBuilder } from '../utils/OptionsUIBuilders';
import { deprecationWarning } from '../utils/deprecationWarning';

import { createFieldConfigRegistry } from './registryFactories';

/** @beta */
export type StandardOptionConfig = {
  defaultValue?: any;
  settings?: any;
  hideFromDefaults?: boolean;
};

/** @beta */
export interface SetFieldConfigOptionsArgs<TFieldConfigOptions = any> {
  /**
   * Configuration object of the standard field config properites
   *
   * @example
   * ```typescript
   * {
   *   standardOptions: {
   *     [FieldConfigProperty.Decimals]: {
   *       defaultValue: 3
   *     }
   *   }
   * }
   * ```
   */
  standardOptions?: Partial<Record<FieldConfigProperty, StandardOptionConfig>>;

  /**
   * Array of standard field config properties that should not be available in the panel
   * @example
   * ```typescript
   * {
   *   disableStandardOptions: [FieldConfigProperty.Min, FieldConfigProperty.Max, FieldConfigProperty.Unit]
   * }
   * ```
   */
  disableStandardOptions?: FieldConfigProperty[];

  /**
   * Function that allows custom field config properties definition.
   *
   * @param builder
   *
   * @example
   * ```typescript
   * useCustomConfig: builder => {
   *   builder
   *    .addNumberInput({
   *      id: 'shapeBorderWidth',
   *      name: 'Border width',
   *      description: 'Border width of the shape',
   *      settings: {
   *        min: 1,
   *        max: 5,
   *      },
   *    })
   *    .addSelect({
   *      id: 'displayMode',
   *      name: 'Display mode',
   *      description: 'How the shape shout be rendered'
   *      settings: {
   *      options: [{value: 'fill', label: 'Fill' }, {value: 'transparent', label: 'Transparent }]
   *    },
   *  })
   * }
   * ```
   */
  useCustomConfig?: (builder: FieldConfigEditorBuilder<TFieldConfigOptions>) => void;
}

export type PanelOptionsSupplier<TOptions> = (
  builder: PanelOptionsEditorBuilder<TOptions>,
  context: StandardEditorContext<TOptions>
) => void;

export class PanelPlugin<
  TOptions = any,
  TFieldConfigOptions extends object = {},
> extends GrafanaPlugin<PanelPluginMeta> {
  private _defaults?: TOptions;
  private _fieldConfigDefaults: FieldConfigSource<TFieldConfigOptions> = {
    defaults: {},
    overrides: [],
  };

  private _fieldConfigRegistry?: FieldConfigOptionsRegistry;
  private _initConfigRegistry = () => {
    return new FieldConfigOptionsRegistry();
  };

  private optionsSupplier?: PanelOptionsSupplier<TOptions>;
  private suggestionsSupplier?: VisualizationSuggestionsSupplier;

  panel: ComponentType<PanelProps<TOptions>> | null;
  editor?: ComponentClass<PanelEditorProps<TOptions>>;
  onPanelMigration?: PanelMigrationHandler<TOptions>;
  shouldMigrate?: (panel: ComponentType<PanelProps<TOptions>> | null) => boolean;
  onPanelTypeChanged?: PanelTypeChangedHandler<TOptions>;
  noPadding?: boolean;
  dataSupport: PanelPluginDataSupport = {
    annotations: false,
    alertStates: false,
  };

  /**
   * Legacy angular ctrl. If this exists it will be used instead of the panel
   */
  angularPanelCtrl?: any;

  constructor(panel: ComponentType<PanelProps<TOptions>> | null) {
    super();
    this.panel = panel;
  }

  get defaults() {
    let result = this._defaults || {};

    if (!this._defaults && this.optionsSupplier) {
      const builder = new PanelOptionsEditorBuilder<TOptions>();
      this.optionsSupplier(builder, { data: [] });
      for (const item of builder.getItems()) {
        if (item.defaultValue != null) {
          set(result, item.path, item.defaultValue);
        }
      }
    }

    return result;
  }

  get fieldConfigDefaults(): FieldConfigSource<TFieldConfigOptions> {
    const configDefaults = this._fieldConfigDefaults.defaults;
    configDefaults.custom = {} as TFieldConfigOptions;

    for (const option of this.fieldConfigRegistry.list()) {
      if (option.defaultValue === undefined) {
        continue;
      }

      set(configDefaults, option.id, option.defaultValue);
    }

    return {
      defaults: {
        ...configDefaults,
      },
      overrides: this._fieldConfigDefaults.overrides,
    };
  }

  /**
   * @deprecated setDefaults is deprecated in favor of setPanelOptions
   */
  setDefaults(defaults: TOptions) {
    deprecationWarning('PanelPlugin', 'setDefaults', 'setPanelOptions');
    this._defaults = defaults;
    return this;
  }

  get fieldConfigRegistry() {
    if (!this._fieldConfigRegistry) {
      this._fieldConfigRegistry = this._initConfigRegistry();
    }

    return this._fieldConfigRegistry;
  }

  /**
   * @deprecated setEditor is deprecated in favor of setPanelOptions
   */
  setEditor(editor: ComponentClass<PanelEditorProps<TOptions>>) {
    deprecationWarning('PanelPlugin', 'setEditor', 'setPanelOptions');
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
   * If shouldMigrate is provided, it will be called regardless of whether
   * the version has changed, and can explicitly opt into running the
   * migration handler
   *
   * This is a good place to support any changes to the options model
   */
  setMigrationHandler(
    handler: PanelMigrationHandler<TOptions>,
    shouldMigrate?: (panel: ComponentType<PanelProps<TOptions>> | null) => boolean
  ) {
    this.onPanelMigration = handler;
    this.shouldMigrate = shouldMigrate;
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
  setPanelOptions(builder: PanelOptionsSupplier<TOptions>) {
    // builder is applied lazily when options UI is created
    this.optionsSupplier = builder;
    return this;
  }

  /**
   * This is used while building the panel options editor.
   *
   * @internal
   */
  getPanelOptionsSupplier(): PanelOptionsSupplier<TOptions> {
    return this.optionsSupplier ?? (() => {});
  }

  /**
   * Tells Grafana if the plugin should subscribe to annotation and alertState results.
   *
   * @example
   * ```typescript
   *
   * import { ShapePanel } from './ShapePanel';
   *
   * interface ShapePanelOptions {}
   *
   * export const plugin = new PanelPlugin<ShapePanelOptions>(ShapePanel)
   *     .useFieldConfig({})
   *     ...
   *     ...
   *     .setDataSupport({
   *       annotations: true,
   *       alertStates: true,
   *     });
   * ```
   *
   * @public
   **/
  setDataSupport(support: Partial<PanelPluginDataSupport>) {
    this.dataSupport = { ...this.dataSupport, ...support };
    return this;
  }

  /**
   * Allows specifying which standard field config options panel should use and defining default values
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
   *  .useFieldConfig();
   *
   * // when plugin should only display specific standard options
   * // note, that options will be displayed in the order they are provided
   * export const plugin = new PanelPlugin<ShapePanelOptions>(ShapePanel)
   *  .useFieldConfig({
   *    standardOptions: [FieldConfigProperty.Min, FieldConfigProperty.Max]
   *   });
   *
   * // when standard option's default value needs to be provided
   * export const plugin = new PanelPlugin<ShapePanelOptions>(ShapePanel)
   *  .useFieldConfig({
   *    standardOptions: [FieldConfigProperty.Min, FieldConfigProperty.Max],
   *    standardOptionsDefaults: {
   *      [FieldConfigProperty.Min]: 20,
   *      [FieldConfigProperty.Max]: 100
   *    }
   *  });
   *
   * // when custom field config options needs to be provided
   * export const plugin = new PanelPlugin<ShapePanelOptions>(ShapePanel)
   *  .useFieldConfig({
   *    useCustomConfig: builder => {
   *      builder
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
   *         options: [{value: 'fill', label: 'Fill' }, {value: 'transparent', label: 'Transparent }]
   *       },
   *     })
   *   },
   *  });
   *
   * ```
   *
   * @public
   */
  useFieldConfig(config: SetFieldConfigOptionsArgs<TFieldConfigOptions> = {}) {
    // builder is applied lazily when custom field configs are accessed
    this._initConfigRegistry = () => createFieldConfigRegistry(config, this.meta.name);

    return this;
  }

  /**
   * Sets function that can return visualization examples and suggestions.
   * @alpha
   */
  setSuggestionsSupplier(supplier: VisualizationSuggestionsSupplier) {
    this.suggestionsSupplier = supplier;
    return this;
  }

  /**
   * Returns the suggestions supplier
   * @alpha
   */
  getSuggestionsSupplier(): VisualizationSuggestionsSupplier | undefined {
    return this.suggestionsSupplier;
  }

  hasPluginId(pluginId: string) {
    return this.meta.id === pluginId;
  }
}
