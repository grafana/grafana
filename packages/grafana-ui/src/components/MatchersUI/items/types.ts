import type * as React from 'react';

import {
  type DataFrame,
  type ItemKindContext,
  type ItemKindDescriptor,
  type ItemMatcherInfo,
  type RegistryItem,
} from '@grafana/data';

/**
 * Registry entry for one way of selecting marks in the panel editor.
 *
 * The item-shaped counterpart of {@link FieldMatcherUIRegistryItem}.
 *
 * @alpha
 */
export interface ItemMatcherUIRegistryItem<TOptions> extends RegistryItem {
  component: React.ComponentType<ItemMatcherUIProps<TOptions>>;
  matcher: ItemMatcherInfo<TOptions>;
  /* Maps matcher options to a human-readable label for the rule summary */
  optionsToLabel: (options: TOptions) => string;
}

/**
 * @alpha
 */
export interface ItemMatcherUIProps<T> {
  matcher: ItemMatcherInfo<T>;
  id?: string;
  /** The kind this rule targets. Supplies the selectable marks for the current data. */
  kind: ItemKindDescriptor;
  data: DataFrame[];
  /** Panel state the kind needs to enumerate its marks. */
  itemContext: ItemKindContext;
  options: T;
  onChange: (options: T) => void;
}
