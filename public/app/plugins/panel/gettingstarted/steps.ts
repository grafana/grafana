import { getDatasourceSrv } from '../../../features/plugins/datasource_srv';
import { getBackendSrv } from '../../../core/services/backend_srv';
import { SetupStep } from './types';

export const getSteps = (): SetupStep[] => [
  {
    heading: 'Welcome to Grafana',
    subheading: 'The steps below will guide you to quickly finish setting up your Grafana installation.',
    title: 'Basic',
    info: 'The steps below will guide you to quickly finish setting up your Grafana installation.',
    done: false,
    cards: [
      {
        type: 'tutorial',
        heading: 'Data source and dashboards',
        title: 'Grafana fundamentals',
        info:
          'Set up and understand Grafana if you have no prior experience. This tutorial guides you through the entire process and covers the “Data source” and “Dashboards” steps to the right.',
        href: 'datasources/new?gettingstarted',
        icon: 'grafana',
        check: () => Promise.resolve(false),
      },
      {
        type: 'docs',
        title: 'Add your first data source',
        icon: 'database',
        href: 'dashboard/new?gettingstarted',
        check: () => {
          return new Promise(resolve => {
            resolve(
              getDatasourceSrv()
                .getMetricSources()
                .filter(item => {
                  return item.meta.builtIn !== true;
                }).length > 0
            );
          });
        },
      },
      {
        type: 'docs',
        heading: 'dashboards',
        title: 'Create your first dashboard',
        icon: 'apps',
        href: 'something',
        check: async () => {
          const result = await getBackendSrv().search({ limit: 1 });
          return result.length > 0;
        },
      },
    ],
  },
  {
    heading: 'Setup complete!',
    subheading:
      'All necessary steps to use Grafana are done. Now tackle advanced steps or make the best use of this home dashboard – it is, after all, a fully customizable dashboard – and remove this panel.',
    title: 'Advanced',
    info: ' Manage your users and teams and add plugins. These steps are optional',
    done: false,
    cards: [
      {
        type: 'tutorial',
        heading: 'Users',
        title: 'Create users and teams',
        info: 'Learn to organize your users in teams and manage resource access and roles.',
        href: 'org/users?gettingstarted',
        icon: 'users-alt',
        check: () => Promise.resolve(false),
      },
      {
        type: 'docs',
        heading: 'plugins',
        title: 'Find and install plugins',
        href: 'https://grafana.com/plugins?utm_source=grafana_getting_started',
        icon: 'plug',
        check: async () => {
          const plugins = await getBackendSrv().get('/api/plugins', { embedded: 0, core: 0 });
          return Promise.resolve(plugins.length > 0);
        },
      },
    ],
  },
];
