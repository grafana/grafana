import { TestScope } from './scope-helpers';

export const testScopes = (scopeBindingSetting?: { uid: string; title: string }): TestScope[] => {
  return [
    {
      name: 'sn-databases',
      title: 'Databases',
      children: [
        {
          name: 'sn-databases-m',
          title: 'Mimir',
          children: [
            {
              name: 'sn-databases-m-mimir-dev-10',
              title: 'mimir-dev-10',
              filters: [{ key: 'namespace', operator: 'equals', value: 'mimir-dev-10' }],
              dashboardTitle: scopeBindingSetting?.title ?? 'CUJ Dashboard 2',
              dashboardUid: scopeBindingSetting?.uid ?? 'cuj-dashboard-2',
              type: 'type',
              category: 'category',
              addLinks: true,
            },
            {
              name: 'sn-databases-m-mimir-dev-11',
              title: 'mimir-dev-11',
              filters: [{ key: 'namespace', operator: 'equals', value: 'mimir-dev-11' }],
              category: 'category',
              type: 'type',
              addLinks: true,
            },
          ],
        },
        {
          name: 'sn-databases-l',
          title: 'Loki',
          children: [
            {
              name: 'sn-databases-l-loki-dev-010',
              title: 'loki-dev-010',
              filters: [{ key: 'namespace', operator: 'equals', value: 'loki-dev-010' }],
              dashboardTitle: scopeBindingSetting?.title ?? 'CUJ Dashboard 2',
              dashboardUid: scopeBindingSetting?.uid ?? 'cuj-dashboard-2',
              addLinks: true,
            },
            {
              name: 'sn-databases-l-loki-dev-009',
              title: 'loki-dev-009',
              filters: [{ key: 'namespace', operator: 'equals', value: 'loki-dev-009' }],
              addLinks: true,
            },
          ],
        },
      ],
    },
    {
      name: 'sn-hg',
      title: 'Hosted Grafana',
      children: [
        {
          name: 'sn-hg-c',
          title: 'Cluster',
          children: [
            {
              name: 'sn-hg-c-dev-eu-west-2-hosted-grafana',
              title: 'dev-eu-west-2',
              filters: [{ key: 'cluster', operator: 'equals', value: 'dev-eu-west-2' }],
              dashboardTitle: scopeBindingSetting?.title ?? 'CUJ Dashboard 2',
              dashboardUid: scopeBindingSetting?.uid ?? 'cuj-dashboard-2',
              addLinks: true,
            },
            {
              name: 'sn-hg-c-dev-us-central-0-hosted-grafana',
              title: 'dev-us-central-0',
              filters: [{ key: 'cluster', operator: 'equals', value: 'dev-us-central-0' }],
              addLinks: true,
            },
          ],
        },
      ],
    },
    {
      name: 'sn-other-teams',
      title: 'Other teams',
      children: [
        {
          name: 'sn-other-teams-t',
          title: 'Test',
          disableMultiSelect: true,
          children: [
            {
              name: 'sn-other-teams-t-multi',
              title: 'Multi group',
              children: [],
              addLinks: true,
            },
            {
              name: 'sn-other-teams-t-another',
              title: 'Another group',
              addLinks: true,
              filters: [],
            },
          ],
        },
      ],
    },
  ];
};
