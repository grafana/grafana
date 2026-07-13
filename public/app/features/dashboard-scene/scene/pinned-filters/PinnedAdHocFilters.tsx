import { css } from '@emotion/css';
import { type ReactNode, useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { AdHocFiltersComboboxRenderer, type AdHocFiltersVariable } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { PinnedAwareFiltersController } from './PinnedAwareFiltersController';
import { PinnedFilterControl } from './PinnedFilterControl';
import { getPinnedFilters } from './pinnedFilters';

export interface PinnedAdHocFiltersProps {
  variable: AdHocFiltersVariable;
  /** Rendered before the bulk filters combobox (the variable's own label). */
  bulkFiltersLabel?: ReactNode;
  labelClassName?: string;
}

/**
 * Renders an ad hoc filters variable as a set of standalone, always-visible value pickers (one
 * per pinned filter) followed by the regular bulk filters combobox for everything else.
 */
export function PinnedAdHocFilters({ variable, bulkFiltersLabel, labelClassName }: PinnedAdHocFiltersProps) {
  const styles = useStyles2(getStyles);
  const { originFilters } = variable.useState();
  const controller = useMemo(() => new PinnedAwareFiltersController(variable), [variable]);
  const pinnedFilters = getPinnedFilters(originFilters);

  return (
    <div className={styles.wrapper}>
      {pinnedFilters.map((filter) => (
        <PinnedFilterControl key={filter.key} variable={variable} filter={filter} labelClassName={labelClassName} />
      ))}
      <div className={styles.bulkContainer}>
        {bulkFiltersLabel}
        <AdHocFiltersComboboxRenderer controller={controller} />
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  bulkContainer: css({
    display: 'inline-flex',
    alignItems: 'center',
    verticalAlign: 'middle',
    // No border for second element (inputs) as label and input border is shared
    '> :nth-child(2)': css({
      borderTopLeftRadius: 'unset',
      borderBottomLeftRadius: 'unset',
    }),
  }),
});
