import { type ReactElement } from 'react';

import { TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Panel } from '@grafana/schema';
import { AddToDashboardForm } from 'app/features/dashboard-scene/addToDashboard/AddToDashboardForm';
import { useSelector } from 'app/types/store';

import { getExploreItemSelector } from '../../state/selectors';

import { buildDashboardPanelFromExploreState } from './addToDashboard';

interface Props {
  onClose: () => void;
  exploreId: string;
  // explore apps can send a panel and time range for now
  panelData?: { panel: Panel; range: TimeRange };
}

export function ExploreToDashboardPanel(props: Props): ReactElement {
  // extension point panelData
  const { exploreId, onClose, panelData } = props;

  const exploreItem = useSelector(getExploreItemSelector(exploreId));

  const buildPanel = () => {
    if (panelData) {
      // the panel data from metrics drilldown is already built
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
      title: t('dashboard.new-panel-title', 'New panel'),
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
