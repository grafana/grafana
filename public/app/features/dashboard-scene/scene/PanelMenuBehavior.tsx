import { locationUtil, PanelMenuItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { VizPanel, VizPanelMenu } from '@grafana/scenes';
import { t } from 'app/core/internationalization';

import { getPanelIdForVizPanel } from '../utils/utils';

/**
 * Behavior is called when VizPanelMenu is activated (ie when it's opened).
 */
export function panelMenuBehavior(menu: VizPanelMenu) {
  // hm.. add another generic param to SceneObject to specify parent type?
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const panel = menu.parent as VizPanel;

  const location = locationService.getLocation();
  const items: PanelMenuItem[] = [];

  // TODO
  // Add tracking via reportInteraction (but preserve the fact that these are normal links)

  items.push({
    text: t('panel.header-menu.view', `View`),
    iconClassName: 'eye',
    shortcut: 'v',
    // Hm... need the numeric id to be url compatible?
    href: locationUtil.getUrlForPartial(location, { viewPanel: getPanelIdForVizPanel(panel) }),
  });

  items.push({
    text: t('panel.header-menu.inspect', `Inspect`),
    iconClassName: 'info-circle',
    shortcut: 'i',
    // Hm... need the numeric id to be url compatible?
    href: locationUtil.getUrlForPartial(location, { inspect: getPanelIdForVizPanel(panel) }),
  });

  menu.setState({ items });
}
