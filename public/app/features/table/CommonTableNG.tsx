import { type ComponentProps } from 'react';

import {
  useFlagTableAutoColumnWidths,
  useFlagTableRefresh,
  useFlagTableRefreshNewFeatures,
} from '@grafana/runtime/internal';
import { TableNG } from '@grafana/ui/unstable';

import { useTableRefreshNewFeatures } from './hooks';

export type CommonTableNGProps = Omit<
  ComponentProps<typeof TableNG>,
  'tableRefreshEnabled' | 'rowTransformationsEnabled' | 'contentAwareWidthsEnabled' | 'jsonSyntaxHighlightingEnabled'
>;

/**
 * Wraps `TableNG` with the feature-toggle-driven props common to every caller. `useCommonTableProps`
 * covers full panels (it also maps `TableOptions`/`FieldConfigSource` into TableNG props), but a
 * caller with no real panel options — like the Inspect Data tab's raw-frame preview — has nothing to
 * feed it. This reads just the flags and needs nothing else.
 */
export function CommonTableNG(props: CommonTableNGProps) {
  const rowTransformationsEnabled = useTableRefreshNewFeatures();
  const tableRefreshEnabled = useFlagTableRefresh();
  const contentAwareWidthsEnabled = useFlagTableAutoColumnWidths();
  const jsonSyntaxHighlightingEnabled = useFlagTableRefreshNewFeatures();

  return (
    <TableNG
      {...props}
      rowTransformationsEnabled={rowTransformationsEnabled}
      tableRefreshEnabled={tableRefreshEnabled}
      contentAwareWidthsEnabled={contentAwareWidthsEnabled}
      jsonSyntaxHighlightingEnabled={jsonSyntaxHighlightingEnabled}
    />
  );
}
