import { PluginExtensionAddedLinkConfig, PluginExtensionPoints } from '@grafana/data';
import { contextSrv } from 'app/core/core';
import { dispatch } from 'app/store/store';
import { AccessControlAction } from 'app/types/accessControl';

import { log } from '../../plugins/extensions/logs/log';
import { createAddedLinkConfig } from '../../plugins/extensions/utils';
import { changeCorrelationEditorDetails } from '../state/main';
import { runQueries } from '../state/query';

import {
  DrilldownAppToDashboardPanel,
  PluginExtensionDrilldownContext,
} from './AddToDashboard/DrilldownAppToDashboardPanel';
import { ExploreToDashboardPanel } from './AddToDashboard/ExploreToDashboardPanel';
import { getAddToDashboardTitle } from './AddToDashboard/getAddToDashboardTitle';
import { type PluginExtensionExploreContext } from './ToolbarExtensionPoint';

export function getExploreExtensionConfigs(): PluginExtensionAddedLinkConfig[] {
  try {
    return [
      createAddedLinkConfig<PluginExtensionExploreContext>({
        // This is called at the top level, so will break if we add a translation here 😱
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        title: 'Add to dashboard',
        description: 'Use the query and panel from explore and create/add it to a dashboard',
        targets: [PluginExtensionPoints.ExploreToolbarAction],
        icon: 'apps',
        category: 'Dashboards',
        configure: configureAddToDashboard,
        onClick: (_, { context, openModal }) => {
          openModal({
            title: getAddToDashboardTitle(),
            body: ({ onDismiss }) => <ExploreToDashboardPanel onClose={onDismiss!} exploreId={context?.exploreId!} />,
          });
        },
      }),
      createAddedLinkConfig<PluginExtensionExploreContext>({
        // This is called at the top level, so will break if we add a translation here 😱
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        title: 'Add correlation',
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
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
      createAddedLinkConfig<PluginExtensionDrilldownContext>({
        // grafana-metricsdrilldown-app/add-to-dashboard/v1
        // This is called at the top level, so will break if we add a translation here 😱
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        title: 'Add metrics drilldown panel to dashboard',
        description: 'Use the panel from metrics drilldown and create/add it to a dashboard',
        targets: ['grafana-metricsdrilldown-app/add-to-dashboard/v1'],
        icon: 'apps',
        category: 'Dashboards',
        configure: configureAddToDashboard,
        onClick: (_, { context, openModal }) => {
          const panelData = context?.panelData;

          if (!panelData) {
            return;
          }

          openModal({
            title: getAddToDashboardTitle(),
            body: ({ onDismiss }) => (
              //ADD
              <DrilldownAppToDashboardPanel onClose={onDismiss!} panelData={panelData} />
            ),
          });
        },
      }),
    ];
  } catch (error) {
    log.warning(`Could not configure extensions for Explore due to: "${error}"`);
    return [];
  }
}

const configureAddToDashboard = () => {
  const canAddPanelToDashboard =
    contextSrv.hasPermission(AccessControlAction.DashboardsCreate) ||
    contextSrv.hasPermission(AccessControlAction.DashboardsWrite);

  // hide option if user has insufficient permissions
  if (!canAddPanelToDashboard) {
    return undefined;
  }

  return {};
};
