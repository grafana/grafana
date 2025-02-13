import { PluginExtensionAddedLinkConfig, PluginExtensionPoints } from '@grafana/data';
import { contextSrv } from 'app/core/core';
import { DataSourceTestSuccessExploreLinkContextV1 } from 'app/features/datasources/components/DataSourceTestingStatus';
import { dispatch } from 'app/store/store';
import { AccessControlAction } from 'app/types';

import { log } from '../../plugins/extensions/logs/log';
import { createAddedLinkConfig } from '../../plugins/extensions/utils';
import { changeCorrelationEditorDetails } from '../state/main';
import { runQueries } from '../state/query';

import { ExploreToDashboardPanel } from './AddToDashboard/ExploreToDashboardPanel';
import { getAddToDashboardTitle } from './AddToDashboard/getAddToDashboardTitle';
import { type PluginExtensionExploreContext } from './ToolbarExtensionPoint';

export function getExploreExtensionConfigs(): PluginExtensionAddedLinkConfig[] {
  try {
    return [
      createAddedLinkConfig<PluginExtensionExploreContext>({
        title: 'Add to dashboard',
        description: 'Use the query and panel from explore and create/add it to a dashboard',
        targets: [PluginExtensionPoints.ExploreToolbarAction],
        icon: 'apps',
        category: 'Dashboards',
        configure: () => {
          const canAddPanelToDashboard =
            contextSrv.hasPermission(AccessControlAction.DashboardsCreate) ||
            contextSrv.hasPermission(AccessControlAction.DashboardsWrite);

          // hide option if user has insufficient permissions
          if (!canAddPanelToDashboard) {
            return undefined;
          }

          return {};
        },
        onClick: (_, { context, openModal }) => {
          openModal({
            title: getAddToDashboardTitle(),
            body: ({ onDismiss }) => <ExploreToDashboardPanel onClose={onDismiss!} exploreId={context?.exploreId!} />,
          });
        },
      }),
      createAddedLinkConfig<PluginExtensionExploreContext>({
        title: 'Add correlation',
        description: 'Create a correlation from this query',
        targets: [PluginExtensionPoints.ExploreToolbarAction],
        icon: 'link',
        configure: (context) => {
          return context?.shouldShowAddCorrelation ? {} : undefined;
        },
        onClick: (_, { context }) => {
          dispatch(changeCorrelationEditorDetails({ editorMode: true }));
          dispatch(runQueries({ exploreId: context!.exploreId }));
        },
      }),
      createAddedLinkConfig<DataSourceTestSuccessExploreLinkContextV1>({
        title: 'Explore logs',
        description: 'Explore logs from this data source',
        targets: [PluginExtensionPoints.DataSourceConfigTestSuccessfulExploreLink],
        configure: (context) => {
          switch (context?.dataSource?.type) {
            case 'loki':
              // if you want to override the path property of the link you can do it here by returning an object with a new path property.
              return {
                path: '/explore?ds=loki',
              };
            default:
              return undefined;
          }
        },
        path: '/explore',
      }),
    ];
  } catch (error) {
    log.warning(`Could not configure extensions for Explore due to: "${error}"`);
    return [];
  }
}
