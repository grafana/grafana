import { type ComponentProps } from 'react';

import { useFlagTableAutoColumnWidths, useFlagTableRefresh } from '@grafana/runtime/internal';
import { TableNG } from '@grafana/ui/unstable';

export type CommonTableNGProps = Omit<
  ComponentProps<typeof TableNG>,
  'tableRefreshEnabled' | 'tableRefreshNewFeaturesEnabled' | 'contentAwareWidthsEnabled'
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

  // Deliberately not `tableRefreshNewFeaturesEnabled`: that is the table panel's refreshed feature
  // set, and a caller with no panel options behind it has nowhere to put the state those features
  // produce. The refreshed header is a look rather than a feature, so it does apply here.
  return (
    <TableNG
      {...props}
      tableRefreshEnabled={tableRefreshEnabled}
      contentAwareWidthsEnabled={contentAwareWidthsEnabled}
    />
  );
}
