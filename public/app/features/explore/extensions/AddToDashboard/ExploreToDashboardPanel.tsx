import { type ReactElement } from 'react';

import { AddToDashboardForm } from 'app/features/dashboard-scene/addToDashboard/AddToDashboardForm';
import { useSelector } from 'app/types/store';

import { getExploreItemSelector } from '../../state/selectors';

import { buildDashboardPanelFromExploreState } from './addToDashboard';

interface Props {
  onClose: () => void;
  exploreId: string;
}

export function ExploreToDashboardPanel(props: Props): ReactElement {
  const { exploreId, onClose } = props;
  const exploreItem = useSelector(getExploreItemSelector(exploreId))!;

  const buildPanel = () => {
    return buildDashboardPanelFromExploreState({
      datasource: exploreItem.datasourceInstance?.getRef(),
      queries: exploreItem.queries,
      queryResponse: exploreItem.queryResponse,
      panelState: exploreItem?.panelsState,
    });
  };

  return (
    <AddToDashboardForm onClose={onClose} buildPanel={buildPanel} timeRange={exploreItem.range} options={undefined} />
  );
}
