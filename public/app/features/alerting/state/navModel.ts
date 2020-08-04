import { AlertRulePascalCaseDTO } from 'app/types';
import { NavModel, NavModelItem } from '@grafana/data';

export function buildNavModel(alertRule: AlertRulePascalCaseDTO): NavModelItem {
  const navModel = {
    //img: 'bell',
    id: `alert-${alertRule.Id}`,
    subTitle: 'Manage alerts',
    url: '',
    text: alertRule.Name,
    breadcrumbs: [{ title: 'Alerts', url: 'alerting' }],
    children: [
      {
        active: false,
        icon: 'sliders-v-alt',
        id: `alert-${alertRule.Id}`,
        text: 'Settings',
        url: `alerting/edit/${alertRule.Id}/`,
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
