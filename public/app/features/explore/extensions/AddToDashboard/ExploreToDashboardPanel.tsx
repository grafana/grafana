import { type ReactElement } from 'react';

import { TimeRange } from '@grafana/data';
import { Panel } from '@grafana/schema';
import { AddToDashboardForm } from 'app/features/dashboard-scene/addToDashboard/AddToDashboardForm';
import { useSelector } from 'app/types';

import { getExploreItemSelector } from '../../state/selectors';

import { buildDashboardPanelFromExploreState } from './addToDashboard';

interface Props {
  onClose: () => void;
  exploreId: string;
  // explore apps can send a panel and time range for now
  panelData?: { panel: Panel; range: TimeRange };
}

export function ExploreToDashboardPanel(props: Props): ReactElement {
  const { exploreId, onClose, panelData } = props;

  // the props can include a prebuilt panel json object to use over the explore item
  const exploreItem = panelData ? undefined : useSelector(getExploreItemSelector(exploreId));

  const buildPanel = () => {
    if (panelData) {
      return panelData.panel;
    }

    if (exploreItem) {
      return buildDashboardPanelFromExploreState({
        datasource: exploreItem.datasourceInstance?.getRef(),
        queries: exploreItem.queries,
        queryResponse: exploreItem.queryResponse,
        panelState: exploreItem.panelsState,
      });
    }

    // Return a default panel if neither panelData nor exploreItem exist
    return {
      type: 'timeseries',
      title: 'New Panel',
      gridPos: { x: 0, y: 0, w: 12, h: 8 },
      targets: [],
    };
  };
  // if explore item time range is undefined, then make a default time range
  const timeRange = panelData?.range || exploreItem?.range;
  // this is used eventually to navigate correctly to dashboard and not use the explore app url
  const options = panelData ? 'external-app' : undefined;

  return <AddToDashboardForm onClose={onClose} buildPanel={buildPanel} timeRange={timeRange} options={options} />;
}
