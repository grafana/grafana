import { css } from '@emotion/css';
import { useCallback, useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import {
  type SceneComponentProps,
  type SceneObject,
  SceneObjectBase,
  type SceneObjectState,
} from '@grafana/scenes';
import { Icon, PanelChrome, Tooltip, useStyles2 } from '@grafana/ui';
import { useListPanelMentionsQuery } from 'app/features/pulse/api/pulseApi';

import { type DashboardScene } from './DashboardScene';

/**
 * PanelPulseMentions renders a small Pulse icon in the panel title-bar
 * row whenever there is open Pulse activity that mentions or anchors
 * to that panel on this dashboard. The icon is hidden when no
 * matching activity exists and when the dashboardPulse feature toggle
 * is off, so panels stay clean by default.
 *
 * Click behaviour ("smart" navigation):
 *  - 1 matching thread → navigate straight to it via `?pulse=thread-<uid>`
 *  - 2+ matching threads → open the drawer with the panel filter
 *    pre-applied via `?pulse=open&pulsePanel=<id>`, so the user lands
 *    in the same filterable list view they'd reach by selecting the
 *    panel from the in-drawer dropdown. The dropdown shows "Clear
 *    filters" so they can broaden out without leaving the drawer.
 *
 * Both URL forms are handled by `PulseDrawer`'s URL sync (`getUrlState` /
 * `updateFromUrl`), so this component never touches dashboard scene
 * state directly. Going through the URL also gives a stable
 * shareable link for free.
 *
 * Data flow: every `PanelPulseMentions` instance on a dashboard calls
 * `useListPanelMentionsQuery` with the same arguments, so RTK Query
 * dedupes them into a single round-trip. Each component then selects
 * its own row from the cached payload. The query is invalidated on
 * the existing Pulse live channel (`useResourcePulseStream`) and on
 * the relevant write mutations, so icons appear/disappear without a
 * page refresh.
 */
export interface PanelPulseMentionsState extends SceneObjectState {
  panelId: number;
}

export class PanelPulseMentions extends SceneObjectBase<PanelPulseMentionsState> {
  static Component = PanelPulseMentionsRenderer;
}

/**
 * Self-contained guard mirroring the trick `PulseDrawer.tsx` uses to
 * avoid the import cycle that closes when scene/-tier files reach for
 * `getDashboardSceneFor` from `../utils/utils`. We import
 * `DashboardScene` only as a type (erased at compile time) and check
 * the constructor name at runtime; webpack preserves class names in
 * production, same assumption `PulseDrawer` already relies on.
 */
function isDashboardSceneRoot(obj: SceneObject): obj is DashboardScene {
  return obj.constructor.name === 'DashboardScene';
}

function getRootDashboardScene(sceneObject: SceneObject): DashboardScene | null {
  const root = sceneObject.getRoot();
  return isDashboardSceneRoot(root) ? root : null;
}

function PanelPulseMentionsRenderer({ model }: SceneComponentProps<PanelPulseMentions>) {
  const styles = useStyles2(getStyles);
  const { panelId } = model.useState();
  const dashboard = getRootDashboardScene(model);
  const resourceUID = dashboard?.useState().uid ?? '';

  // Two off-switches: the global feature toggle, and the per-render
  // "I have nowhere to point at" check. Both must skip the network
  // call entirely so we don't generate 404 noise on stock OSS or
  // before the dashboard finishes loading.
  const isPulseEnabled = Boolean(config.featureToggles.dashboardPulse);
  const skipQuery = !isPulseEnabled || !resourceUID;

  const { data } = useListPanelMentionsQuery(
    { resourceKind: 'dashboard', resourceUID },
    { skip: skipQuery }
  );

  // The summary list comes back sorted by panel id; a Map keyed by id
  // keeps lookup O(1) per render across all panels mounted on the
  // dashboard.
  const summary = useMemo(() => {
    if (!data) {
      return undefined;
    }
    return data.mentions.find((m) => m.panelId === panelId);
  }, [data, panelId]);

  const onClick = useCallback(() => {
    if (!summary || summary.threadCount === 0) {
      return;
    }
    // One match → straight to the thread (single-thread case never
    // benefits from the filtered list view). Multiple matches → open
    // the drawer with the Panel filter pre-applied so the user lands
    // in the same dropdown-driven filtered view they could have built
    // by hand. We always pin `pulse=open` alongside `pulsePanel` to
    // ensure the drawer mounts even when the URL didn't already
    // contain the `pulse` key.
    if (summary.threadCount === 1 && summary.latestThreadUID) {
      locationService.partial(
        { pulse: `thread-${summary.latestThreadUID}`, pulsePanel: null },
        true
      );
      return;
    }
    locationService.partial({ pulse: 'open', pulsePanel: String(panelId) }, true);
  }, [summary, panelId]);

  if (!summary || summary.threadCount === 0) {
    return null;
  }

  // Single tooltip string for both single and multi-thread cases.
  // Using count keeps copy short — title-bar real estate is scarce —
  // and matches the user-selected "count_only" tooltip style.
  const tooltip =
    summary.threadCount === 1
      ? t('dashboard-scene.panel-pulse-mentions.tooltip-one', '1 thread mentions this panel')
      : t('dashboard-scene.panel-pulse-mentions.tooltip-many', '{{count}} threads mention this panel', {
          count: summary.threadCount,
        });

  return (
    <Tooltip content={tooltip}>
      <PanelChrome.TitleItem className={styles.item} onClick={onClick}>
        <Icon name="comment-alt" size="md" />
      </PanelChrome.TitleItem>
    </Tooltip>
  );
}

function getStyles(_theme: GrafanaTheme2) {
  return {
    // Inherit the same affordances PanelChrome.TitleItem applies to
    // its other interactive children (info icon, link icon).
    item: css({
      cursor: 'pointer',
    }),
  };
}
