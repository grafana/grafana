import type * as React from 'react';

import { type RegistryItem, type FieldMatcherInfo } from '@grafana/data';
import { type DataFrame } from '@grafana/data/dataframe';
import { type MatcherScope } from '@grafana/schema';

export interface FieldMatcherUIRegistryItem<TOptions> extends RegistryItem {
  component: React.ComponentType<MatcherUIProps<TOptions>>;
  matcher: FieldMatcherInfo<TOptions>;
  /* Maps matcher options to human-readable label */
  optionsToLabel: (options: TOptions) => string;
}

export interface MatcherUIProps<T> {
  matcher: FieldMatcherInfo<T>;
  id?: string;
  data: DataFrame[];
  options: T;
  scope?: MatcherScope;
  onChange: (options: T, scope?: MatcherScope) => void;
}
