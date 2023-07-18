import React from 'react';

import { PluginExtensionPoints, type PluginExtensionLinkConfig } from '@grafana/data';
import { contextSrv } from 'app/core/core';
import { NewAlertRuleFromExploreForm } from 'app/features/alerting/unified/components/explore/NewAlertRuleForm';
import { AccessControlAction } from 'app/types';

import { createExtensionLinkConfig, logWarning } from '../../plugins/extensions/utils';

import { AddToDashboardForm } from './AddToDashboard/AddToDashboardForm';
import { getAddToDashboardTitle } from './AddToDashboard/getAddToDashboardTitle';
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
            contextSrv.hasAccess(AccessControlAction.AlertingRuleCreate, contextSrv.isEditor) ||
            contextSrv.hasAccess(AccessControlAction.AlertingRuleExternalWrite, contextSrv.isEditor);

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
      createExtensionLinkConfig<PluginExtensionExploreContext>({
        title: 'New alert rule',
        description: 'Use the query and panel from explore and create/add it to a new alert rule',
        extensionPointId: PluginExtensionPoints.ExploreToolbarAction,
        icon: 'bell',
        configure: () => {
          const canCreateNewAlertRule = contextSrv.hasAccess(
            AccessControlAction.AlertingRuleCreate,
            contextSrv.isEditor
          );

          // hide option if user has insufficient permissions
          if (!canCreateNewAlertRule) {
            return undefined;
          }

          return {};
        },
        onClick: (_, { context, openModal }) => {
          openModal({
            title: 'Create new alert rule',
            body: ({ onDismiss }) => (
              <NewAlertRuleFromExploreForm onClose={onDismiss!} exploreId={context?.exploreId!} />
            ),
          });
        },
      }),
    ];
  } catch (error) {
    logWarning(`Could not configure extensions for Explore due to: "${error}"`);
    return [];
  }
}
