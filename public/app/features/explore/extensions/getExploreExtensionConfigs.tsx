import { type PluginExtensionAddedLinkConfig, PluginExtensionPoints } from '@grafana/data';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { contextSrv } from 'app/core/services/context_srv';
import { addPanelToNotebookTitle } from 'app/features/notebook/addPanel/LazyAddPanelToNotebookModalBody';
import { canAddPanelToNotebook } from 'app/features/notebook/permissions';
import { dispatch } from 'app/store/store';
import { AccessControlAction } from 'app/types/accessControl';

import { log } from '../../plugins/extensions/logs/log';
import { createAddedLinkConfig } from '../../plugins/extensions/utils';
import { changeCorrelationEditorDetails } from '../state/main';
import { runQueries } from '../state/query';

import { ExploreToDashboardPanel } from './AddToDashboard/ExploreToDashboardPanel';
import { getAddToDashboardTitle } from './AddToDashboard/getAddToDashboardTitle';
import { ExploreToNotebookPanel } from './AddToNotebook/ExploreToNotebookPanel';
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
      createAddedLinkConfig<PluginExtensionExploreContext>({
        // This is called at the top level, so will break if we add a translation here 😱
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        title: 'Add to notebook',
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        description: 'Add the query and panel from explore to a notebook',
        targets: [PluginExtensionPoints.ExploreToolbarAction],
        icon: 'search',
        category: 'Dashboards',
        configure: () => {
          // Returning undefined when notebooks are off matters beyond hiding the item: BasicExtensions
          // renders the bare "Add to dashboard" button only while a single link is configured, and
          // switches to an "Add" dropdown past that. Staying hidden keeps Explore's toolbar exactly as
          // it is for everyone not running notebooks.
          if (!getFeatureFlagClient().getBooleanValue(FlagKeys.DashboardNotebooks, false)) {
            return undefined;
          }

          return canAddPanelToNotebook() ? {} : undefined;
        },
        onClick: (_, { context, openModal }) => {
          openModal({
            title: addPanelToNotebookTitle(),
            body: ({ onDismiss }) => <ExploreToNotebookPanel onClose={onDismiss!} exploreId={context?.exploreId!} />,
          });
        },
      }),
    ];
  } catch (error) {
    log.warning(`Could not configure extensions for Explore due to: "${error}"`);
    return [];
  }
}
