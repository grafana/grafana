import { getDatasourceSrv } from '../../../features/plugins/datasource_srv';
import { backendSrv } from '../../../core/services/backend_srv';

export const getSteps = () => [
  {
    heading: 'Welcome to Grafana',
    subheading: 'The steps below will guide you to quickly finish setting up your Grafana installation.',
    title: 'Basic',
    info: 'The steps below will guide you to quickly finish setting up your Grafana installation.',
    cards: [
      {
        title: 'Create a data source',
        cta: 'Add data source',
        icon: 'gicon gicon-datasources',
        href: 'datasources/new?gettingstarted',
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
        title: 'Build a dashboard',
        cta: 'New dashboard',
        icon: 'gicon gicon-dashboard',
        href: 'dashboard/new?gettingstarted',
        check: () => {
          return backendSrv.search({ limit: 1 }).then(result => {
            return result.length > 0;
          });
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
    cards: [
      {
        title: 'Invite your team',
        cta: 'Add Users',
        icon: 'gicon gicon-team',
        href: 'org/users?gettingstarted',
        check: () => {
          return backendSrv.get('/api/org/users/lookup').then((res: any) => {
            /* return res.length > 1; */
            return false;
          });
        },
      },
      {
        title: 'Install apps & plugins',
        cta: 'Explore plugin repository',
        icon: 'gicon gicon-plugins',
        href: 'https://grafana.com/plugins?utm_source=grafana_getting_started',
        check: () => {
          return backendSrv.get('/api/plugins', { embedded: 0, core: 0 }).then((plugins: any[]) => {
            return plugins.length > 0;
          });
        },
      },
    ],
  },
];
