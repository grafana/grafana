import { type ComponentProps } from 'react';

import {
  useFlagTableAutoColumnWidths,
  useFlagTableRefresh,
  useFlagTableRefreshNewFeatures,
} from '@grafana/runtime/internal';
import { TableNG } from '@grafana/ui/unstable';

export type CommonTableNGProps = Omit<
  ComponentProps<typeof TableNG>,
  'tableRefreshEnabled' | 'contentAwareWidthsEnabled' | 'jsonSyntaxHighlightingEnabled'
>;

/**
 * Wraps `TableNG` with the feature-toggle-driven props common to every caller. `useCommonTableProps`
 * covers full panels (it also maps `TableOptions`/`FieldConfigSource` into TableNG props), but a
 * caller with no real panel options — like the Inspect Data tab's raw-frame preview — has nothing to
 * feed it. This reads just the flags and needs nothing else.
 */
export function CommonTableNG(props: CommonTableNGProps) {
  const tableRefreshEnabled = useFlagTableRefresh();
  const contentAwareWidthsEnabled = useFlagTableAutoColumnWidths();
  const jsonSyntaxHighlightingEnabled = useFlagTableRefreshNewFeatures();

  return (
    <TableNG
      {...props}
      tableRefreshEnabled={tableRefreshEnabled}
      contentAwareWidthsEnabled={contentAwareWidthsEnabled}
      jsonSyntaxHighlightingEnabled={jsonSyntaxHighlightingEnabled}
    />
  );
}
