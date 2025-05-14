import Skeleton from 'react-loading-skeleton';

import { Alert, Text } from '@grafana/ui';

import { useGetAffectedItemsQuery } from '../../api/browseDashboardsAPI';
import { DashboardTreeSelection } from '../../types';

import { buildBreakdownString } from './utils';

export interface Props {
  selectedItems: DashboardTreeSelection;
}

export const DescendantCount = ({ selectedItems }: Props) => {
  const { data, isFetching, isLoading, error } = useGetAffectedItemsQuery(selectedItems);

  return error ? (
    <Alert severity="error" title="Unable to retrieve descendant information" />
  ) : (
    <Text element="p" color="secondary">
      {data && buildBreakdownString(data.folder, data.dashboard, data.libraryPanel, data.alertRule)}
      {(isFetching || isLoading) && <Skeleton width={200} />}
    </Text>
  );
};
