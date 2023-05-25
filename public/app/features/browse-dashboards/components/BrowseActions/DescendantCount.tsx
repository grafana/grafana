import React from 'react';

import { Alert, Spinner, useTheme2 } from '@grafana/ui';
import { P } from '@grafana/ui/src/unstable';

import { useGetAffectedItemsQuery } from '../../api/browseDashboardsAPI';
import { DashboardTreeSelection } from '../../types';

import { buildBreakdownString } from './utils';

export interface Props {
  selectedItems: DashboardTreeSelection;
}

export const DescendantCount = ({ selectedItems }: Props) => {
  const theme = useTheme2();
  const { data, isFetching, isLoading, error } = useGetAffectedItemsQuery(selectedItems);

  return (
    <>
      {data && (
        <P color="secondary">{buildBreakdownString(data.folder, data.dashboard, data.libraryPanel, data.alertRule)}</P>
      )}

      {(isFetching || isLoading) && <Spinner size={theme.typography.body.fontSize} />}
      {error && <Alert severity="error" title="Unable to retrieve descendant information" />}
    </>
  );
};
