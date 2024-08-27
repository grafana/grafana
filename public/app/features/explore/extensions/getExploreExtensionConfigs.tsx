import { PluginExtensionAddedLinkConfig, PluginExtensionPoints } from '@grafana/data';
import { contextSrv } from 'app/core/core';
import { dispatch } from 'app/store/store';
import { AccessControlAction } from 'app/types';

import { createAddedLinkConfig, logWarning } from '../../plugins/extensions/utils';
import { changeCorrelationEditorDetails } from '../state/main';
import { runQueries } from '../state/query';

import { AddToDashboardForm } from './AddToDashboard/AddToDashboardForm';
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
            body: ({ onDismiss }) => <AddToDashboardForm onClose={onDismiss!} exploreId={context?.exploreId!} />,
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
    ];
  } catch (error) {
    logWarning(`Could not configure extensions for Explore due to: "${error}"`);
    return [];
  }
}
