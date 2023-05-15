import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Spinner, useStyles2 } from '@grafana/ui';

import { useGetAffectedItemsQuery } from '../../api/browseDashboardsAPI';
import { DashboardTreeSelection } from '../../types';

import { buildBreakdownString } from './utils';

export interface Props {
  label?: string;
  selectedItems: DashboardTreeSelection;
}

export const DescendantCount = ({ label, selectedItems }: Props) => {
  const styles = useStyles2(getStyles);
  const { data, isFetching, isLoading, error } = useGetAffectedItemsQuery(selectedItems);

  return (
    <div>
      {label}
      <div className={styles.breakdown}>
        <>
          {data && buildBreakdownString(data.folder, data.dashboard, data.libraryPanel, data.alertRule)}
          {(isFetching || isLoading) && <Spinner size={12} />}
          {error && <Alert severity="error" title="Unable to retrieve descendant information" />}
        </>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  breakdown: css({
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing(2),
  }),
});
