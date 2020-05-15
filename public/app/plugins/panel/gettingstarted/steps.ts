import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getBackendSrv } from 'app/core/services/backend_srv';
import store from 'app/core/store';
import { SetupStep } from './types';

const step1TutorialTitle = 'Grafana fundamentals';
const step2TutorialTitle = 'Create users and teams';
const keyPrefix = 'getting.started.';
const step1Key = `${keyPrefix}${step1TutorialTitle
  .replace(' ', '-')
  .trim()
  .toLowerCase()}`;
const step2Key = `${keyPrefix}${step2TutorialTitle
  .replace(' ', '-')
  .trim()
  .toLowerCase()}`;

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
        title: step1TutorialTitle,
        info:
          'Set up and understand Grafana if you have no prior experience. This tutorial guides you through the entire process and covers the “Data source” and “Dashboards” steps to the right.',
        href: 'https://grafana.com/tutorials/grafana-fundamentals',
        icon: 'grafana',
        check: () => Promise.resolve(store.get(step1Key)),
        key: step1Key,
        done: false,
      },
      {
        type: 'docs',
        title: 'Add your first data source',
        heading: 'data sources',
        icon: 'database',
        learnHref: 'https://grafana.com/docs/grafana/latest/features/datasources/add-a-data-source',
        href: 'datasources/new',
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
        done: false,
      },
      {
        type: 'docs',
        heading: 'dashboards',
        title: 'Create your first dashboard',
        icon: 'apps',
        href: 'dashboard/new',
        learnHref: 'https://grafana.com/docs/grafana/latest/guides/getting_started/#create-a-dashboard',
        check: async () => {
          const result = await getBackendSrv().search({ limit: 1 });
          return result.length > 0;
        },
        done: false,
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
        href: 'https://grafana.com/tutorials/create-users-and-teams',
        icon: 'users-alt',
        key: step2Key,
        check: () => Promise.resolve(store.get(step2Key)),
        done: false,
      },
      {
        type: 'docs',
        heading: 'plugins',
        title: 'Find and install plugins',
        learnHref: 'https://grafana.com/docs/grafana/latest/plugins/installation',
        href: 'plugins',
        icon: 'plug',
        check: async () => {
          const plugins = await getBackendSrv().get('/api/plugins', { embedded: 0, core: 0 });
          return Promise.resolve(plugins.length > 0);
        },
        done: false,
      },
    ],
  },
];
