import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { MonitoringStatus } from '../../Inventory.types';

export const getStyles = ({ visualization }: GrafanaTheme2, status: MonitoringStatus) => ({
  link: css`
    text-decoration: underline;
    color: ${getColor(visualization, status)};
  `,
});

const getColor = (visualization: GrafanaTheme2['visualization'], status: MonitoringStatus) => {
  if (status === MonitoringStatus.FAILED) {
    return visualization.getColorByName('red');
  }

  if (status === MonitoringStatus.WARNING) {
    return visualization.getColorByName('orange');
  }

  return visualization.getColorByName('green');
};
