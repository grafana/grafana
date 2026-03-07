import { DataFrame } from './dataFrame';

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
  showIf?: (currentOptions: TOptions, data?: DataFrame[], annotations?: DataFrame[]) => boolean | undefined;

  /**
   * When true, this option will appear in the dashboard edit pane for quick editing
   * without entering the full panel editor.
   *
   * **Behavior:**
   * - Only the first 5 options with `quickEdit: true` will be shown
   * - Options appear in the order they are added to the builder
   * - A console warning is logged if more than 5 options have `quickEdit: true`
   *
   * **Shared option builders:**
   * When using shared builders like `commonOptionsBuilder.addLegendOptions()`, any
   * `quickEdit` flags set in those builders will apply to ALL panels using them.
   * The order depends on when the shared builder is called relative to panel-specific
   * options. If a shared builder adds 2 quickEdit options and a panel adds 4 more,
   * only the first 5 (based on builder order) will be shown.
   *
   * @alpha
   */
  quickEdit?: boolean;
}
