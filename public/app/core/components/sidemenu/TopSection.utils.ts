import { NavModelItem } from '@grafana/data';

import config from '../../config';

export const buildIntegratedAlertingMenuItem = (mainLinks: NavModelItem[]): NavModelItem[] => {
  const integratedAlertingLink: NavModelItem = {
    id: 'integrated-alerting',
    text: 'Integrated Alerting',
    icon: 'list-ul',
    url: `${config.appSubUrl}/integrated-alerting`,
  };
  const divider = {
    id: 'divider',
    text: 'Divider',
    divider: true,
    hideFromTabs: true,
  };
  const alertingIndex = mainLinks.findIndex(({ id }) => id === 'alerting');

  if (alertingIndex >= 0) {
    mainLinks[alertingIndex].children?.unshift(integratedAlertingLink, divider);
  }

  return mainLinks;
};
