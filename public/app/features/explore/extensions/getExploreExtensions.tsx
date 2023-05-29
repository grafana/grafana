import React from 'react';

import { PluginExtensionExploreContext, PluginExtensionPoints, type PluginExtensionLinkConfig } from '@grafana/data';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, ExploreId } from 'app/types';

import { createExtensionLinkConfig } from '../../plugins/extensions/utils';

import { AddToDashboardBody } from './AddToDashboard/AddToDashboardBody';

export function getExploreExtensions(): PluginExtensionLinkConfig[] {
  return [
    createExtensionLinkConfig<PluginExtensionExploreContext>({
      title: 'Panel on dashboard',
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
}

function toExploreId(id: string | undefined): ExploreId {
  switch (id) {
    case 'left':
      return ExploreId.left;
    default:
      return ExploreId.right;
  }
}
