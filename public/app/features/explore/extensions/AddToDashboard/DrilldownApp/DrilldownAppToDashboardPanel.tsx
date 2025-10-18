import { type ReactElement } from 'react';

import { t } from '@grafana/i18n';
import { AddToDashboardForm } from 'app/features/dashboard-scene/addToDashboard/AddToDashboardForm';

import { DrilldownPanelData } from './types';

interface Props {
  onClose: () => void;
  panelData?: DrilldownPanelData;
}

export function DrilldownAppToDashboardPanel(props: Props): ReactElement {
  // extension point panelData
  const { onClose, panelData } = props;

  const buildPanel = () => {
    if (panelData) {
      // the panel data from metrics drilldown is already built
      return panelData.panel;
    }

    // Return a default panel if neither panelData nor exploreItem exist
    return {
      type: 'timeseries',
      title: t('dashboard.new-panel-title', 'New panel'),
      gridPos: { x: 0, y: 0, w: 12, h: 8 },
      targets: [],
    };
  };

  const timeRange = panelData?.range;
  // this is used eventually to navigate correctly to dashboard and not use the explore app url
  const options = panelData ? { isExternalApp: true } : undefined;

  return <AddToDashboardForm onClose={onClose} buildPanel={buildPanel} timeRange={timeRange} options={options} />;
}
