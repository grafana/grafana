import { Action, locationService } from '@grafana/runtime';

const globalActions: Action[] = [
  {
    id: 'go/home',
    name: 'Go to home',
    keywords: 'navigate',
    perform: () => locationService.push('/'),
    section: 'Navigation',
    shortcut: ['g', 'h'],
  },
  {
    id: 'go/search',
    name: 'Go to dashboard search',
    keywords: 'navigate',
    perform: () => locationService.push('?search=open'),
    section: 'Navigation',
    shortcut: ['s', 'o'],
  },
  {
    id: 'go/dashboard',
    name: 'Go to dashboard...',
    keywords: 'navigate',
    section: 'Navigation',
  },
  {
    id: 'go/explore',
    name: 'Go to explore',
    keywords: 'navigate',
    perform: () => locationService.push('/explore'),
    section: 'Navigation',
  },
  {
    id: 'go/alerting',
    name: 'Go to alerting',
    keywords: 'navigate notification',
    perform: () => locationService.push('/alerting'),
    section: 'Navigation',
  },
  {
    id: 'go/configuration',
    name: 'Go to data sources configuration',
    keywords: 'navigate settings ds',
    perform: () => locationService.push('/datasources'),
    section: 'Navigation',
  },
  {
    id: 'go/profile',
    name: 'Go to profile',
    keywords: 'navigate preferences',
    perform: () => locationService.push('/profile'),
    section: 'Navigation',
    shortcut: ['g', 'p'],
  },
  {
    id: 'management/create-dashboard',
    name: 'Create dashboard',
    keywords: 'new add',
    perform: () => locationService.push('/dashboard/new'),
    section: 'Management',
  },
  {
    id: 'management/create-folder',
    name: 'Create folder',
    keywords: 'new add',
    perform: () => locationService.push('/dashboards/folder/new'),
    section: 'Management',
  },
  {
    id: 'preferences/theme',
    name: 'Change theme...',
    keywords: 'interface color dark light',
    section: 'Preferences',
  },
  {
    id: 'preferences/dark-theme',
    name: 'Dark',
    keywords: 'dark theme',
    section: '',
    perform: () => {
      locationService.push({ search: '?theme=dark' });
      location.reload();
    },
    parent: 'preferences/theme',
  },
  {
    id: 'preferences/light-theme',
    name: 'Light',
    keywords: 'light theme',
    section: '',
    perform: () => {
      locationService.push({ search: '?theme=light' });
      location.reload();
    },
    parent: 'preferences/theme',
  },
];

export default () => {
  return globalActions;
};
