import { locationUtil, PanelMenuItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { VizPanel, VizPanelMenu } from '@grafana/scenes';
import { t } from 'app/core/internationalization';

import { getDashboardUrl, getPanelIdForVizPanel } from '../utils/utils';

import { DashboardScene } from './DashboardScene';

/**
 * Behavior is called when VizPanelMenu is activated (ie when it's opened).
 */
export function panelMenuBehavior(menu: VizPanelMenu) {
  // hm.. add another generic param to SceneObject to specify parent type?
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const panel = menu.parent as VizPanel;
  const location = locationService.getLocation();
  const items: PanelMenuItem[] = [];
  const panelId = getPanelIdForVizPanel(panel);
  const dashboard = panel.getRoot();

  // TODO
  // Add tracking via reportInteraction (but preserve the fact that these are normal links)

  if (dashboard instanceof DashboardScene) {
    items.push({
      text: t('panel.header-menu.view', `View`),
      iconClassName: 'eye',
      shortcut: 'v',
      href: getDashboardUrl({
        uid: dashboard.state.uid,
        currentQueryParams: location.search,
        updateQuery: { filter: null, new: 'A' },
      }),
    });

    // We could check isEditing here but I kind of think this should always be in the menu,
    // and going into panel edit should make the dashboard go into edit mode is it's not already
    items.push({
      text: t('panel.header-menu.edit', `Edit`),
      iconClassName: 'eye',
      shortcut: 'v',
      href: getDashboardUrl({
        uid: dashboard.state.uid,
        subPath: `/panel-edit/${panelId}`,
        currentQueryParams: location.search,
        updateQuery: { filter: null, new: 'A' },
      }),
    });
  }

  items.push({
    text: t('panel.header-menu.inspect', `Inspect`),
    iconClassName: 'info-circle',
    shortcut: 'i',
    href: locationUtil.getUrlForPartial(location, { inspect: panel.state.key }),
  });

  menu.setState({ items });
}
