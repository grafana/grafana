import { type PanelMenuItem, type PluginExtensionLink, urlUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import { appEvents } from 'app/core/app_events';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { contextSrv } from 'app/core/services/context_srv';
import { getMessageFromError } from 'app/core/utils/errors';
import { getExploreUrl } from 'app/core/utils/explore';
import { LogMessages, logInfo, trackCreateRuleFromPanelDrawerOpened } from 'app/features/alerting/unified/Analytics';
import { PanelAlertRuleDrawer } from 'app/features/alerting/unified/components/PanelAlertRuleDrawer';
import { type RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { panelToRuleFormValues } from 'app/features/alerting/unified/utils/rule-form';
import { type DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { type PanelModel } from 'app/features/dashboard/state/PanelModel';
import {
  addLibraryPanel,
  copyPanel,
  duplicatePanel,
  removePanel,
  sharePanel,
  toggleLegend,
  unlinkLibraryPanel,
} from 'app/features/dashboard/utils/panel';
import { InspectTab } from 'app/features/inspector/types';
import { isPanelModelLibraryPanel } from 'app/features/library-panels/guard';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';
import { dispatch } from 'app/store/store';
import { ShowModalReactEvent } from 'app/types/events';

import { getCreateAlertInMenuAvailability } from '../../alerting/unified/utils/access-control';
import { navigateToExplore } from '../../explore/state/main';
import { getTimeSrv } from '../services/TimeSrv';

import { appendExtensionsToPanelMenu } from './appendExtensionsToPanelMenu';

export function getPanelMenu(
  dashboard: DashboardModel,
  panel: PanelModel,
  extensions: PluginExtensionLink[]
): PanelMenuItem[] {
  const onViewPanel = (event: React.MouseEvent) => {
    event.preventDefault();
    locationService.partial({
      viewPanel: panel.id,
    });
  };

  const onEditPanel = (event: React.MouseEvent) => {
    event.preventDefault();
    locationService.partial({
      editPanel: panel.id,
    });
  };

  const onSharePanel = (event: React.MouseEvent) => {
    event.preventDefault();
    sharePanel(dashboard, panel);
  };

  const onAddLibraryPanel = (event: React.MouseEvent) => {
    event.preventDefault();
    addLibraryPanel(dashboard, panel);
  };

  const onUnlinkLibraryPanel = (event: React.MouseEvent) => {
    event.preventDefault();
    unlinkLibraryPanel(panel);
  };

  const onInspectPanel = (tab?: InspectTab) => {
    locationService.partial({
      inspect: panel.id,
      inspectTab: tab,
    });
  };

  const onDuplicatePanel = (event: React.MouseEvent) => {
    event.preventDefault();
    duplicatePanel(dashboard, panel);
  };

  const onCopyPanel = (event: React.MouseEvent) => {
    event.preventDefault();
    copyPanel(panel);
  };

  const onRemovePanel = (event: React.MouseEvent) => {
    event.preventDefault();
    removePanel(dashboard, panel, true);
  };

  const onNavigateToExplore = (event: React.MouseEvent) => {
    event.preventDefault();
    const openInNewWindow = event.ctrlKey || event.metaKey ? (url: string) => window.open(url) : undefined;
    dispatch(
      navigateToExplore(panel, {
        timeRange: getTimeSrv().timeRange(),
        getExploreUrl,
        openInNewWindow,
      })
    );
  };

  const onToggleLegend = (event: React.MouseEvent) => {
    event.preventDefault();
    toggleLegend(panel);
  };

  const menu: PanelMenuItem[] = [];

  if (!panel.isEditing) {
    menu.push({
      text: t('panel.header-menu.view', `View`),
      iconClassName: 'eye',
      onClick: onViewPanel,
      shortcut: 'v',
    });
  }

  if (dashboard.canEditPanel(panel) && !panel.isEditing) {
    menu.push({
      text: t('panel.header-menu.edit', `Edit`),
      iconClassName: 'edit',
      onClick: onEditPanel,
      shortcut: 'e',
    });
  }

  menu.push({
    text: t('panel.header-menu.share', `Share`),
    iconClassName: 'share-alt',
    onClick: onSharePanel,
    shortcut: 'p s',
  });

  if (
    contextSrv.hasAccessToExplore() &&
    !(panel.plugin && panel.plugin.meta.skipDataQuery) &&
    panel.datasource?.uid !== SHARED_DASHBOARD_QUERY
  ) {
    menu.push({
      text: t('panel.header-menu.explore', `Explore`),
      iconClassName: 'compass',
      onClick: onNavigateToExplore,
      shortcut: 'p x',
    });
  }

  const inspectMenu: PanelMenuItem[] = [];

  // Only show these inspect actions for data plugins
  if (panel.plugin && !panel.plugin.meta.skipDataQuery) {
    inspectMenu.push({
      text: t('panel.header-menu.inspect-data', `Data`),
      onClick: (e: React.MouseEvent) => onInspectPanel(InspectTab.Data),
    });

    if (dashboard.meta.canEdit) {
      inspectMenu.push({
        text: t('panel.header-menu.query', `Query`),
        onClick: (e: React.MouseEvent) => onInspectPanel(InspectTab.Query),
      });
    }
  }

  inspectMenu.push({
    text: t('panel.header-menu.inspect-json', `Panel JSON`),
    onClick: (e: React.MouseEvent) => onInspectPanel(InspectTab.JSON),
  });

  menu.push({
    type: 'submenu',
    text: t('panel.header-menu.inspect', `Inspect`),
    iconClassName: 'info-circle',
    shortcut: 'i',
    subMenu: inspectMenu,
  });

  const createAlert = async () => {
    let formValues: Partial<RuleFormValues> | undefined;
    try {
      formValues = await panelToRuleFormValues(panel, dashboard);
    } catch (err) {
      const message = `Error getting rule values from the panel: ${getMessageFromError(err)}`;
      dispatch(notifyApp(createErrorNotification(message)));
      return;
    }

    // When the drawer flow is disabled, fall back to the legacy full-page rule editor.
    // This preserves the historical behaviour of navigating with whatever defaults are available
    // (including undefined, which simply lands the user in a blank form).
    if (!config.featureToggles.createAlertRuleFromPanel) {
      const ruleFormUrl = urlUtil.renderUrl('/alerting/new', {
        defaults: JSON.stringify(formValues),
        returnTo: window.location.pathname + window.location.search,
      });
      locationService.push(ruleFormUrl);
      return;
    }

    // The drawer is intentionally narrower than the full rule editor and has no datasource picker,
    // so a blank drawer would leave the user with no way to recover. Surface the same info as the
    // edit-panel button's inline Alert and skip opening the drawer.
    if (!formValues) {
      dispatch(
        notifyApp(
          createErrorNotification(
            t(
              'alerting.new-rule-from-panel-button.title-no-alerting-capable-query-found',
              'No alerting capable query found'
            ),
            t(
              'alerting.new-rule-from-panel-button.body-no-alerting-capable-query-found',
              'Cannot create alerts from this panel because no query to an alerting capable datasource is found.'
            )
          )
        )
      );
      return;
    }

    logInfo(LogMessages.alertRuleFromPanel);
    trackCreateRuleFromPanelDrawerOpened();

    appEvents.publish(
      new ShowModalReactEvent({
        component: PanelAlertRuleDrawer,
        props: { prefill: formValues },
      })
    );
  };

  const onCreateAlert = (event: React.MouseEvent) => {
    event.preventDefault();
    createAlert();
  };

  const subMenu: PanelMenuItem[] = [];
  const canEdit = dashboard.canEditPanel(panel);
  const isCreateAlertMenuOptionAvailable = getCreateAlertInMenuAvailability();

  if (!(panel.isViewing || panel.isEditing)) {
    if (canEdit) {
      subMenu.push({
        text: t('panel.header-menu.duplicate', `Duplicate`),
        onClick: onDuplicatePanel,
        shortcut: 'p d',
      });

      subMenu.push({
        text: t('panel.header-menu.copy', `Copy`),
        onClick: onCopyPanel,
      });

      if (isPanelModelLibraryPanel(panel)) {
        subMenu.push({
          text: t('panel.header-menu.unlink-library-panel', `Unlink library panel`),
          onClick: onUnlinkLibraryPanel,
        });
      } else {
        subMenu.push({
          text: t('panel.header-menu.create-library-panel', `Create library panel`),
          onClick: onAddLibraryPanel,
        });
      }
    } else if (contextSrv.isEditor) {
      // An editor but the dashboard is not editable
      subMenu.push({
        text: t('panel.header-menu.copy', `Copy`),
        onClick: onCopyPanel,
      });
    }
  }

  if (isCreateAlertMenuOptionAvailable) {
    subMenu.push({
      text: t('panel.header-menu.new-alert-rule', `New alert rule`),
      onClick: onCreateAlert,
    });
  }

  if (panel.options.legend) {
    subMenu.push({
      text: panel.options.legend.showLegend
        ? t('panel.header-menu.hide-legend', 'Hide legend')
        : t('panel.header-menu.show-legend', 'Show legend'),
      onClick: onToggleLegend,
      shortcut: 'p l',
    });
  }

  // When editing hide most actions
  if (panel.isEditing) {
    subMenu.length = 0;
    if (isCreateAlertMenuOptionAvailable) {
      subMenu.push({
        text: t('panel.header-menu.new-alert-rule', `New alert rule`),
        onClick: onCreateAlert,
      });
    }
  }

  if (canEdit && panel.plugin && !panel.plugin.meta.skipDataQuery) {
    subMenu.push({
      text: t('panel.header-menu.get-help', 'Get help'),
      onClick: (e: React.MouseEvent) => onInspectPanel(InspectTab.Help),
    });
  }

  if (extensions.length > 0 && !panel.isEditing) {
    const extensionsSubmenuName = t('dashboard.get-panel-menu.text.extensions', 'Extensions');
    const reservedNames = new Set<string>(menu.map((m) => m.text));
    reservedNames.add(t('panel.header-menu.more', `More...`));
    reservedNames.add(t('panel.header-menu.remove', `Remove`));
    reservedNames.add(extensionsSubmenuName);

    appendExtensionsToPanelMenu({
      extensionsSubmenuName,
      rootMenu: menu,
      extensions,
      reservedNames,
    });
  }

  if (subMenu.length) {
    menu.push({
      type: 'submenu',
      text: t('panel.header-menu.more', `More...`),
      iconClassName: 'cube',
      subMenu,
    });
  }

  if (dashboard.canEditPanel(panel) && !panel.isEditing && !panel.isViewing) {
    menu.push({ type: 'divider', text: '' });

    menu.push({
      text: t('panel.header-menu.remove', `Remove`),
      iconClassName: 'trash-alt',
      onClick: onRemovePanel,
      shortcut: 'p r',
    });
  }

  return menu;
}
