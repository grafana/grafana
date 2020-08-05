import { AlertRule } from 'app/types';
import { NavModel, NavModelItem } from '@grafana/data';

export function buildNavModel(alertRule: AlertRule): NavModelItem {
  const navModel = {
    //img: 'bell',
    id: `alert-${alertRule.id}`,
    subTitle: 'Manage alerts',
    url: '',
    text: alertRule.name,
    breadcrumbs: [{ title: 'Alerts', url: 'alerting' }],
    children: [
      {
        active: false,
        icon: 'sliders-v-alt',
        id: `alert-${alertRule.id}`,
        text: 'Settings',
        url: `alerting/edit/${alertRule.id}/`,
      },
    ],
  };
  return navModel;
}

export function getAlertRuleLoadingNav(): NavModel {
  const node = {
    text: 'Loading...',
    icon: 'icon-gf icon-gf-panel',
  };
  return {
    node: node,
    main: node,
  };
}
