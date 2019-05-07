import { SelectOptionItem } from '../components/Select/Select';

/**
 * Option editors, i.e. BooleanOption have to comply to OptionInputAPI.
 * OptionInputAPI represents UI elements that allow value modification, name it string, boolean, complex object, whatever
 */

interface OptionInputConfig {
  required: boolean;
  label?: string;
}
export interface OptionInputAPI<T> {
  properties?: OptionInputConfig;
  value: T;
  onChange: (value: T, event?: React.SyntheticEvent<HTMLElement>) => void;
}

export interface OptionsRowModel<TOptions> {
  columns: number;
  content: Array<OptionUIModel<TOptions, any> | GroupLayoutUIModel<any>>;
}

export enum OptionsUIType {
  Layout = 'options:layout',
  Group = 'options:group',
  Editor = 'options:editor',
}

export interface OptionsUI<T> {
  type: T;
}
export interface OptionsGrid extends OptionsUI<OptionsUIType.Layout> {
  config: {
    columns: number;
  };
  content: Array<OptionsGrid | OptionsGroup<any> | OptionEditor<any, any>>; // Not allowing nested grids for now
}

// tmp type
export interface OptionsPanelGroup extends OptionsGroup<{ title: string }> {}
export interface OptionsFieldsetGroup extends OptionsGroup<{ legend: string }> {}

export interface OptionsGroup<TConfig> extends OptionsUI<OptionsUIType.Group> {
  config: TConfig;
  component?: React.ComponentType<TConfig>;
  content: Array<OptionEditor<any, any> | OptionsGroup<any>>; // For matter of simpliocity I'm not allowing nesting layuts, groups
}

export interface OptionEditor<TOptions, TKey extends keyof TOptions> extends OptionsUI<OptionsUIType.Editor> {
  editor: AbstractOptionUIModel<OptionInputAPI<TOptions[TKey]>, TKey>;
}

export interface OptionsUIModel<TOptions> {
  model: OptionsGrid | OptionsGroup<any> | OptionEditor<TOptions, any>;
}

export enum OptionType {
  Text = 'text',
  Number = 'number', // Not specifying integer/float as this will be handled on options data schema level
  Boolean = 'boolean',
  Object = 'object',
}

/**
 * Introducing this interface to make sure component for manipulating given option
 * handles the type that's specific for that option.
 * i.e. for maxValue: number we expect the component to accept value property of that type
 * and onChange handler that exposes modified value of that type.
 *
 * onChange has to accept event property as well. Exposing event as a second argument is purposeful.
 * Driver for that is that the primary expected output from InputAPI component is it's modified value rather than the event object.
 * But, event is also very important in certain cases, hence we need to keep it in the API.
 */
export interface OptionUIComponentProps<T> extends OptionInputAPI<T> {}

export interface SelectOptionUIComponentProps<T> extends OptionInputAPI<SelectOptionItem<T>> {
  options: Array<SelectOptionItem<T>>;
}

interface AbstractOptionUIModel<ComponentProps, P> {
  optionType: OptionType;
  /**
   * Name of the options object property
   * i.e. for GaugeOptions type:
   * export const defaults: GaugeOptions = {
   *   minValue: 0,
   *   maxValue: 100,
   *   ...
   * }
   * it could be 'minValue'
   * Question: Should we name it option instead of path?
   */
  property: P;
  /**
   * Keeping component as optional on purpose to enable default components for simple types,
   * i.e. number
   */
  component?: React.ComponentType<ComponentProps>;
  label?: string;
  placeholder?: string;
}

export interface OptionUIModel<TOptions, TKey extends keyof TOptions>
  extends AbstractOptionUIModel<OptionUIComponentProps<TOptions[TKey]>, TKey> {}

type LazySelectOptions<O> = () => Promise<O[]>;

export interface SelectOptionUIModel<TOptions, TKey extends keyof TOptions>
  extends AbstractOptionUIModel<SelectOptionUIComponentProps<TOptions[TKey]>, TKey> {
  options: Array<SelectOptionItem<TOptions[TKey]>> | LazySelectOptions<SelectOptionItem<TOptions[TKey]>>;
}

export enum GroupLayoutType {
  Panel = 'panel',
  Fieldset = 'fieldset',
}

export interface GroupLayoutUIModel<K> {
  type: GroupLayoutType;

  /**
   * Represents options of a given layout
   */
  groupOptions: K;

  /**
   * Represents panel options that belong to a given layout group
   */
  options: Array<OptionUIModel<any, any> | SelectOptionUIModel<any, any>>;
}

/**
 * Represents a container for a group of options.
 * Panel UI for options is characterised by a tit le with a gradient background
 * Use it for grouping related options:
 *
 *      ++++++++++++++++++++++++++++++++++++++
 *      + Panel title                        +
 *      ++++++++++++++++++++++++++++++++++++++
 *      + Option 1                    on/off +
 *      + Option 2                    on/off +
 *      + ...                                +
 *      + ...                                +
 *      ++++++++++++++++++++++++++++++++++++++
 *
 */
export interface PanelUIModel extends GroupLayoutUIModel<{ title: string }> {}

/**
 * Represents a group of options
 * Fieldset UI does not have any characteristic UI elements. It's basically a group of options
 * with a title:
 *
 *      ++++++++++++++++++++++++++++++++++++++
 *      * Fieldset title                     *
 *      *                                    *
 *      + Option 1                    on/off +
 *      + Option 2                    on/off +
 *      + ...                                +
 *      ++++++++++++++++++++++++++++++++++++++
 */
export interface FieldsetUIModel
  extends GroupLayoutUIModel<{
    legend: string;
  }> {} // legend property name inspired by https://www.w3schools.com/tags/tag_legend.asp

/**
 * Below are typeguards used by PanelOptionsBuilder components
 */
export function isOptionsUIModel(model: any): model is OptionsUIModel<any> {
  return (model as OptionsUIModel<any>).model !== undefined;
}

export function isGroupUIModel(model: any): model is OptionsGroup<any> {
  return (model as OptionsGroup<any>).type === OptionsUIType.Group;
}

export function isOptionModel(
  option: OptionUIModel<any, any> | GroupLayoutUIModel<any>
): option is OptionUIModel<any, any> {
  return (option as OptionUIModel<any, any>).property !== undefined;
}

export function isOptionsPanelModel(ui: PanelUIModel | FieldsetUIModel): ui is PanelUIModel {
  return (ui as PanelUIModel).groupOptions.title !== undefined;
}

export function isSelectOption(
  option: OptionUIModel<any, any> | SelectOptionUIModel<any, any>
): option is SelectOptionUIModel<any, any> {
  return (option as SelectOptionUIModel<any, any>).options !== undefined;
}
