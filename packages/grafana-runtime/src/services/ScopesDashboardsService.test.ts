import { ScopeDashboardBinding } from '@grafana/data';

import { filterFolders, groupDashboards } from './ScopesDashboardsService';

const generateScopeDashboardBinding = (dashboardTitle: string, groups?: string[], dashboardId?: string) => ({
  metadata: { name: `${dashboardTitle}-name` },
  spec: {
    dashboard: `${dashboardId ?? dashboardTitle}-dashboard`,
    scope: `${dashboardTitle}-scope`,
  },
  status: {
    dashboardTitle,
    groups,
  },
});

export const dashboardWithoutFolder: ScopeDashboardBinding = generateScopeDashboardBinding('Without Folder');
export const dashboardWithOneFolder: ScopeDashboardBinding = generateScopeDashboardBinding('With one folder', [
  'Folder 1',
]);
export const dashboardWithTwoFolders: ScopeDashboardBinding = generateScopeDashboardBinding('With two folders', [
  'Folder 1',
  'Folder 2',
]);
export const alternativeDashboardWithTwoFolders: ScopeDashboardBinding = generateScopeDashboardBinding(
  'Alternative with two folders',
  ['Folder 1', 'Folder 2'],
  'With two folders'
);
export const dashboardWithRootFolder: ScopeDashboardBinding = generateScopeDashboardBinding('With root folder', ['']);
export const alternativeDashboardWithRootFolder: ScopeDashboardBinding = generateScopeDashboardBinding(
  'Alternative With root folder',
  [''],
  'With root folder'
);
export const dashboardWithRootFolderAndOtherFolder: ScopeDashboardBinding = generateScopeDashboardBinding(
  'With root folder and other folder',
  ['', 'Folder 3']
);

describe('Utils', () => {
  describe('groupDashboards', () => {
    it('Assigns dashboards without groups to root folder', () => {
      expect(groupDashboards([dashboardWithoutFolder])).toEqual({
        '': {
          title: '',
          isExpanded: true,
          folders: {},
          dashboards: {
            [dashboardWithoutFolder.spec.dashboard]: {
              dashboard: dashboardWithoutFolder.spec.dashboard,
              dashboardTitle: dashboardWithoutFolder.status.dashboardTitle,
              items: [dashboardWithoutFolder],
            },
          },
        },
      });
    });

    it('Assigns dashboards with root group to root folder', () => {
      expect(groupDashboards([dashboardWithRootFolder])).toEqual({
        '': {
          title: '',
          isExpanded: true,
          folders: {},
          dashboards: {
            [dashboardWithRootFolder.spec.dashboard]: {
              dashboard: dashboardWithRootFolder.spec.dashboard,
              dashboardTitle: dashboardWithRootFolder.status.dashboardTitle,
              items: [dashboardWithRootFolder],
            },
          },
        },
      });
    });

    it('Merges folders from multiple dashboards', () => {
      expect(groupDashboards([dashboardWithOneFolder, dashboardWithTwoFolders])).toEqual({
        '': {
          title: '',
          isExpanded: true,
          folders: {
            'Folder 1': {
              title: 'Folder 1',
              isExpanded: false,
              folders: {},
              dashboards: {
                [dashboardWithOneFolder.spec.dashboard]: {
                  dashboard: dashboardWithOneFolder.spec.dashboard,
                  dashboardTitle: dashboardWithOneFolder.status.dashboardTitle,
                  items: [dashboardWithOneFolder],
                },
                [dashboardWithTwoFolders.spec.dashboard]: {
                  dashboard: dashboardWithTwoFolders.spec.dashboard,
                  dashboardTitle: dashboardWithTwoFolders.status.dashboardTitle,
                  items: [dashboardWithTwoFolders],
                },
              },
            },
            'Folder 2': {
              title: 'Folder 2',
              isExpanded: false,
              folders: {},
              dashboards: {
                [dashboardWithTwoFolders.spec.dashboard]: {
                  dashboard: dashboardWithTwoFolders.spec.dashboard,
                  dashboardTitle: dashboardWithTwoFolders.status.dashboardTitle,
                  items: [dashboardWithTwoFolders],
                },
              },
            },
          },
          dashboards: {},
        },
      });
    });

    it('Merges scopes from multiple dashboards', () => {
      expect(groupDashboards([dashboardWithTwoFolders, alternativeDashboardWithTwoFolders])).toEqual({
        '': {
          title: '',
          isExpanded: true,
          folders: {
            'Folder 1': {
              title: 'Folder 1',
              isExpanded: false,
              folders: {},
              dashboards: {
                [dashboardWithTwoFolders.spec.dashboard]: {
                  dashboard: dashboardWithTwoFolders.spec.dashboard,
                  dashboardTitle: dashboardWithTwoFolders.status.dashboardTitle,
                  items: [dashboardWithTwoFolders, alternativeDashboardWithTwoFolders],
                },
              },
            },
            'Folder 2': {
              title: 'Folder 2',
              isExpanded: false,
              folders: {},
              dashboards: {
                [dashboardWithTwoFolders.spec.dashboard]: {
                  dashboard: dashboardWithTwoFolders.spec.dashboard,
                  dashboardTitle: dashboardWithTwoFolders.status.dashboardTitle,
                  items: [dashboardWithTwoFolders, alternativeDashboardWithTwoFolders],
                },
              },
            },
          },
          dashboards: {},
        },
      });
    });

    it('Matches snapshot', () => {
      expect(
        groupDashboards([
          dashboardWithoutFolder,
          dashboardWithOneFolder,
          dashboardWithTwoFolders,
          alternativeDashboardWithTwoFolders,
          dashboardWithRootFolder,
          alternativeDashboardWithRootFolder,
          dashboardWithRootFolderAndOtherFolder,
        ])
      ).toEqual({
        '': {
          dashboards: {
            [dashboardWithRootFolderAndOtherFolder.spec.dashboard]: {
              dashboard: dashboardWithRootFolderAndOtherFolder.spec.dashboard,
              dashboardTitle: dashboardWithRootFolderAndOtherFolder.status.dashboardTitle,
              items: [dashboardWithRootFolderAndOtherFolder],
            },
            [dashboardWithRootFolder.spec.dashboard]: {
              dashboard: dashboardWithRootFolder.spec.dashboard,
              dashboardTitle: dashboardWithRootFolder.status.dashboardTitle,
              items: [dashboardWithRootFolder, alternativeDashboardWithRootFolder],
            },
            [dashboardWithoutFolder.spec.dashboard]: {
              dashboard: dashboardWithoutFolder.spec.dashboard,
              dashboardTitle: dashboardWithoutFolder.status.dashboardTitle,
              items: [dashboardWithoutFolder],
            },
          },
          folders: {
            'Folder 1': {
              dashboards: {
                [dashboardWithOneFolder.spec.dashboard]: {
                  dashboard: dashboardWithOneFolder.spec.dashboard,
                  dashboardTitle: dashboardWithOneFolder.status.dashboardTitle,
                  items: [dashboardWithOneFolder],
                },
                [dashboardWithTwoFolders.spec.dashboard]: {
                  dashboard: dashboardWithTwoFolders.spec.dashboard,
                  dashboardTitle: dashboardWithTwoFolders.status.dashboardTitle,
                  items: [dashboardWithTwoFolders, alternativeDashboardWithTwoFolders],
                },
              },
              folders: {},
              isExpanded: false,
              title: 'Folder 1',
            },
            'Folder 2': {
              dashboards: {
                [dashboardWithTwoFolders.spec.dashboard]: {
                  dashboard: dashboardWithTwoFolders.spec.dashboard,
                  dashboardTitle: dashboardWithTwoFolders.status.dashboardTitle,
                  items: [dashboardWithTwoFolders, alternativeDashboardWithTwoFolders],
                },
              },
              folders: {},
              isExpanded: false,
              title: 'Folder 2',
            },
            'Folder 3': {
              dashboards: {
                [dashboardWithRootFolderAndOtherFolder.spec.dashboard]: {
                  dashboard: dashboardWithRootFolderAndOtherFolder.spec.dashboard,
                  dashboardTitle: dashboardWithRootFolderAndOtherFolder.status.dashboardTitle,
                  items: [dashboardWithRootFolderAndOtherFolder],
                },
              },
              folders: {},
              isExpanded: false,
              title: 'Folder 3',
            },
          },
          isExpanded: true,
          title: '',
        },
      });
    });
  });

  describe('filterFolders', () => {
    it('Shows folders matching criteria', () => {
      expect(
        filterFolders(
          {
            '': {
              title: '',
              isExpanded: true,
              folders: {
                'Folder 1': {
                  title: 'Folder 1',
                  isExpanded: false,
                  folders: {},
                  dashboards: {
                    'Dashboard ID': {
                      dashboard: 'Dashboard ID',
                      dashboardTitle: 'Dashboard Title',
                      items: [],
                    },
                  },
                },
                'Folder 2': {
                  title: 'Folder 2',
                  isExpanded: true,
                  folders: {},
                  dashboards: {
                    'Dashboard ID': {
                      dashboard: 'Dashboard ID',
                      dashboardTitle: 'Dashboard Title',
                      items: [],
                    },
                  },
                },
              },
              dashboards: {
                'Dashboard ID': {
                  dashboard: 'Dashboard ID',
                  dashboardTitle: 'Dashboard Title',
                  items: [],
                },
              },
            },
          },
          'Folder'
        )
      ).toEqual({
        '': {
          title: '',
          isExpanded: true,
          folders: {
            'Folder 1': {
              title: 'Folder 1',
              isExpanded: true,
              folders: {},
              dashboards: {
                'Dashboard ID': {
                  dashboard: 'Dashboard ID',
                  dashboardTitle: 'Dashboard Title',
                  items: [],
                },
              },
            },
            'Folder 2': {
              title: 'Folder 2',
              isExpanded: true,
              folders: {},
              dashboards: {
                'Dashboard ID': {
                  dashboard: 'Dashboard ID',
                  dashboardTitle: 'Dashboard Title',
                  items: [],
                },
              },
            },
          },
          dashboards: {},
        },
      });
    });

    it('Shows dashboards matching criteria', () => {
      expect(
        filterFolders(
          {
            '': {
              title: '',
              isExpanded: true,
              folders: {
                'Folder 1': {
                  title: 'Folder 1',
                  isExpanded: false,
                  folders: {},
                  dashboards: {
                    'Dashboard ID': {
                      dashboard: 'Dashboard ID',
                      dashboardTitle: 'Dashboard Title',
                      items: [],
                    },
                  },
                },
                'Folder 2': {
                  title: 'Folder 2',
                  isExpanded: true,
                  folders: {},
                  dashboards: {
                    'Random ID': {
                      dashboard: 'Random ID',
                      dashboardTitle: 'Random Title',
                      items: [],
                    },
                  },
                },
              },
              dashboards: {
                'Dashboard ID': {
                  dashboard: 'Dashboard ID',
                  dashboardTitle: 'Dashboard Title',
                  items: [],
                },
                'Random ID': {
                  dashboard: 'Random ID',
                  dashboardTitle: 'Random Title',
                  items: [],
                },
              },
            },
          },
          'dash'
        )
      ).toEqual({
        '': {
          title: '',
          isExpanded: true,
          folders: {
            'Folder 1': {
              title: 'Folder 1',
              isExpanded: true,
              folders: {},
              dashboards: {
                'Dashboard ID': {
                  dashboard: 'Dashboard ID',
                  dashboardTitle: 'Dashboard Title',
                  items: [],
                },
              },
            },
          },
          dashboards: {
            'Dashboard ID': {
              dashboard: 'Dashboard ID',
              dashboardTitle: 'Dashboard Title',
              items: [],
            },
          },
        },
      });
    });
  });
});
