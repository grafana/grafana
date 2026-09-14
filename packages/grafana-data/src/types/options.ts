import { type StandardEditorContext } from '../field/standardFieldConfigEditorRegistry';

import { type DataFrame } from './dataFrame';

/**
 * Base class for editor builders
 *
 * @beta
 */
export interface OptionEditorConfig<TOptions, TSettings = any, TValue = any, TContextOptions = unknown> {
  /**
   * Path of the option property to control.
   *
   * @example
   * Given options object of a type:
   * ```ts
   * interface Options {
   *   a: {
   *     b: string;
   *   }
   * }
   * ```
   *
   * path can be either 'a' or 'a.b'.
   */
  path: (keyof TOptions & string) | string;

  /**
   * Name of the option. Will be displayed in the UI as form element label.
   */
  name: string;

  /**
   * Description of the option. Will be displayed in the UI as form element description.
   */
  description?: string;

  /**
   * Custom settings of the editor.
   */
  settings?: TSettings;

  /**
   * Array of strings representing category of the option. First element in the array will make option render as collapsible section.
   */
  category?: string[];

  /**
   * Set this value if undefined
   */
  defaultValue?: TValue;

  /**
   * Function that enables configuration of when option editor should be shown.
   *
   * `currentOptions` is the object the editor is registered against: the panel options for a panel
   * option, `fieldConfig.defaults.custom` for a custom field config property, and
   * `fieldConfig.defaults` for a standard one.
   *
   * `context` is the same editor context the editor component receives. `context.fieldConfig` is
   * the whole field config, which lets a condition span both sides of the pane. `context.options`
   * mirrors `currentOptions` rather than adding `addNestedOptions`.
   * The context is undefined when options are built outside an options pane
   */
  showIf?(
    currentOptions: TOptions,
    data?: DataFrame[],
    annotations?: DataFrame[],
    context?: StandardEditorContext<TContextOptions>
  ): boolean | undefined;
}
