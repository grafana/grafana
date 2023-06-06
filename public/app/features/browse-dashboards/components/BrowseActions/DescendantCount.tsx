import React from 'react';
import Skeleton from 'react-loading-skeleton';

import { Alert } from '@grafana/ui';
import { P } from '@grafana/ui/src/unstable';

import { useGetAffectedItemsQuery } from '../../api/browseDashboardsAPI';
import { DashboardTreeSelection } from '../../types';

import { buildBreakdownString } from './utils';

export interface Props {
  selectedItems: DashboardTreeSelection;
}

export const DescendantCount = ({ selectedItems }: Props) => {
  const { data, isFetching, isLoading, error } = useGetAffectedItemsQuery(selectedItems);

  return (
    <>
      <P color="secondary">
        {data && buildBreakdownString(data.folder, data.dashboard, data.libraryPanel, data.alertRule)}
        {(isFetching || isLoading) && <Skeleton width={200} />}
      </P>
      {error && <Alert severity="error" title="Unable to retrieve descendant information" />}
    </>
  );
};
