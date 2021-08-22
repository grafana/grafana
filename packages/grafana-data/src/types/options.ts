import { DataFrame } from './dataFrame';

export interface OptionsEditorPathValue {
  path: string;
  value: any;
}

/**
 * Base class for editor builders
 *
 * @beta
 */
export interface OptionEditorConfig<TOptions, TSettings = any, TValue = any> {
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
   * Function that enables configuration of when option editor should be shown based on current panel option properties.
   */
  showIf?: (currentOptions: TOptions, data?: DataFrame[]) => boolean | undefined;

  /**
   * When this exists it will be called before the value.
   *
   * This function will allow modifying the path and value before they are
   * actually applied.  Returning an empty path will be a noop
   */
  beforeChange?: (change: OptionsEditorPathValue) => OptionsEditorPathValue;

  /**
   * Get any value...
   */
  valueGetter?: (root: any, path: string) => any;
}
