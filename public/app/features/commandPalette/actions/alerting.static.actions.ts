import { Priority } from 'kbar';

import { locationService } from '@grafana/runtime';

import { NavBarActions } from './global.static.actions';

// Grafana Alerting and alerting sub navigation items
const alertingCommandPaletteStaticActions: NavBarActions[] = [
  {
    url: '/alerting/list',
    actions: [
      {
        id: 'go/alerting',
        name: 'Go to alerting',
        keywords: 'alerting navigate',
        perform: () => locationService.push('/alerting'),
        section: 'Navigation',
        priority: Priority.NORMAL,
      },
    ],
  },
  {
    url: '/alerting/list',
    actions: [
      {
        id: 'go/alerting/rules',
        name: 'Go to alert rules',
        keywords: 'alerting navigate rules',
        perform: () => locationService.push('/alerting/list'),
        section: 'Navigation',
        parent: 'go/alerting',
      },
    ],
  },
  {
    url: '/alerting/notifications',
    actions: [
      {
        id: 'go/alerting/contact-points',
        name: 'Go to contact points',
        keywords: 'alerting navigate contact-points',
        perform: () => locationService.push('/alerting/notifications'),
        parent: 'go/alerting',
      },
    ],
  },
  {
    url: '/alerting/routes',
    actions: [
      {
        id: 'go/alerting/notification-policies',
        name: 'Go to notification policies',
        keywords: 'alerting navigate notification-policies',
        perform: () => locationService.push('/alerting/routes'),
        parent: 'go/alerting',
      },
    ],
  },
  {
    url: '/alerting/silences',
    actions: [
      {
        id: 'go/alerting/silences',
        name: 'Go to silences',
        keywords: 'alerting navigate silences',
        perform: () => locationService.push('/alerting/silences'),
        parent: 'go/alerting',
      },
    ],
  },
];

export { alertingCommandPaletteStaticActions };
