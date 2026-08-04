import { type StandardOptionConfig } from '../panel/PanelPlugin';
import { type GrafanaTheme2 } from '../themes/types';
import { type FieldConfigEditorBuilder } from '../utils/OptionsUIBuilders';

import { type DataFrame } from './dataFrame';
import { type DynamicConfigValue, type FieldConfigSource, FieldConfigProperty } from './fieldOverrides';
import { type InterpolateFunction } from './panel';

/**
 * One selectable mark within a panel — a node, an edge, a slice.
 *
 * Field overrides target columns; item overrides target the marks of visualizations
 * whose marks are rows instead.
 *
 * @alpha
 */
export interface PanelItem {
  /** Stable id; this is what matchers store in dashboard JSON. */
  id: string;
  /** Human label for the matcher UI and rule summary. Defaults to id. */
  label?: string;
  description?: string;
}

/**
 * Selects marks of one kind. The analogue of {@link MatcherConfig}; `kind` mirrors `scope`.
 *
 * @alpha
 */
export interface ItemMatcherConfig<TOptions = unknown> {
  id: string;
  kind: string;
  options?: TOptions;
}

/**
 * The analogue of {@link ConfigOverrideRule} for marks that are rows.
 *
 * One rule targets exactly one kind, mirroring the existing rule that field overrides
 * cannot be applied across multiple target scopes.
 *
 * @alpha
 */
export interface ItemOverrideRule {
  matcher: ItemMatcherConfig;
  properties: DynamicConfigValue[];
}

/**
 * Panel state a kind may need to enumerate its marks.
 *
 * Node graph marks come straight from the frames, but a pie slice only exists once the data has
 * been reduced, which depends on the panel's own options — hence the context.
 *
 * @alpha
 */
export interface ItemKindContext<TOptions = unknown> {
  fieldConfig: FieldConfigSource;
  options: TOptions;
  replaceVariables: InterpolateFunction;
  theme: GrafanaTheme2;
}

/**
 * A mark universe declared by a panel plugin, registered via `PanelPlugin.useItemConfig`.
 *
 * @alpha
 */
// The default is `any` so a panel declaring kinds with different custom-config types can hold
// them in one array; TItemConfig is contravariant through useCustomConfig. Same as
// SetFieldConfigOptionsArgs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ItemKindDescriptor<TItemConfig extends object = any> {
  /** Stored in dashboard JSON as `matcher.kind`. Must be stable across releases. */
  id: string;
  /** Human readable name for the kind selector, e.g. "Nodes". */
  name: string;
  /** Resolves the selectable marks for the current data. Used by the matcher UI. */
  getItems: (data: DataFrame[], context: ItemKindContext) => PanelItem[];
  /**
   * Standard properties offered for this kind, keyed the same way as `useFieldConfig`.
   * Defaults to Color and Links. `hideFromDefaults` is ignored: item properties are only
   * ever reached through an override rule, never through a defaults tab.
   */
  standardOptions?: Partial<Record<FieldConfigProperty, StandardOptionConfig>>;
  /** Custom properties for this kind. Registered under `custom.` like field config custom options. */
  useCustomConfig?: (builder: FieldConfigEditorBuilder<TItemConfig>) => void;
}

/**
 * The standard properties an item kind offers when it does not narrow them itself.
 *
 * Both are already field-agnostic (`shouldApply: () => true`), so they apply to a mark
 * as readily as to a field.
 *
 * @alpha
 */
export const defaultItemStandardOptions: FieldConfigProperty[] = [FieldConfigProperty.Color, FieldConfigProperty.Links];
