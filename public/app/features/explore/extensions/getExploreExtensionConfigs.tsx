import React from 'react';

import { PluginExtensionPoints, type PluginExtensionLinkConfig } from '@grafana/data';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, ExploreId } from 'app/types';

import { createExtensionLinkConfig, logWarning } from '../../plugins/extensions/utils';

import { AddToDashboardBody } from './AddToDashboard/AddToDashboardBody';
import { type PluginExtensionExploreContext } from './ToolbarExtensionPoint';

export function getExploreExtensionConfigs(): PluginExtensionLinkConfig[] {
  try {
    return [
      createExtensionLinkConfig<PluginExtensionExploreContext>({
        title: 'Dashboard',
        description: 'Use the query and panel from explore and create/add it to a dashboard',
        extensionPointId: PluginExtensionPoints.ExploreToolbarAction,
        icon: 'apps',
        configure: () => {
          const canAddPanelToDashboard =
            contextSrv.hasAccess(AccessControlAction.DashboardsCreate, contextSrv.isEditor) ||
            contextSrv.hasAccess(AccessControlAction.DashboardsWrite, contextSrv.isEditor);

          // hide option if user has insufficient permissions
          if (!canAddPanelToDashboard) {
            return undefined;
          }

          return {};
        },
        onClick: (_, { context, openModal }) => {
          // temporary solution - will probably map values into context.
          const exploreId = toExploreId(context?.exploreId);

          openModal({
            title: 'Add panel to dashboard',
            body: ({ onDismiss }) => <AddToDashboardBody onClose={onDismiss!} exploreId={exploreId} />,
          });
        },
      }),
    ];
  } catch (error) {
    logWarning(`Could not configure extensions for Explore due to: "${error}"`);
    return [];
  }
}

function toExploreId(id: string | undefined): ExploreId {
  switch (id) {
    case 'left':
      return ExploreId.left;
    default:
      return ExploreId.right;
  }
}
