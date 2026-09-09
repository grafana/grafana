import { Trans, t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase, VizPanel } from '@grafana/scenes';
import { Badge } from '@grafana/ui';

import { getQueryRunnerFor } from '../utils/getQueryRunnerFor';

import { isDashboardSceneLike } from './types/dashboard';

/**
 * Marks a panel in a plan preview as showing sample data rather than query results.
 *
 * It outlives planning mode on purpose. The signal it carries is about the panel — these numbers
 * came from no query — not about the mode the page is in, and the two stop agreeing the moment the
 * user presses Build.
 *
 * The preview deliberately looks like a real dashboard — that fidelity is the whole point — and
 * its panels are seeded with plausible synthetic series so they do not read as broken. Those two
 * choices together make it possible to read a number off a preview and believe it. Every other
 * signal is page chrome: one marker for the whole page, not sticky below md, and absent wherever a
 * panel is seen on its own — a screenshot, a shared image, a single panel filling the viewport.
 * This one travels with the numbers it is warning about.
 *
 * Use as a `titleItems` entry on a VizPanel, alongside VizPanelLinks and PanelNotices.
 */
export class PlanPlaceholderBadge extends SceneObjectBase {
  static Component = PlanPlaceholderBadgeRenderer;

  constructor() {
    super({});
  }

  public getPanel(): VizPanel | null {
    return this.parent instanceof VizPanel ? this.parent : null;
  }
}

function PlanPlaceholderBadgeRenderer({ model }: SceneComponentProps<PlanPlaceholderBadge>) {
  const panel = model.getPanel();
  const dashboard = model.getRoot();

  if (!panel || !isDashboardSceneLike(dashboard)) {
    return null;
  }

  return <PlanPlaceholderBadgeContent panel={panel} />;
}

/**
 * Split from the renderer so the state subscription is unconditional: whether the badge has a panel
 * to read is settled by the scene graph, not by React.
 *
 * Deliberately says nothing about the dashboard's planning state. This badge is only ever attached
 * to a panel `ADD_PANEL` built while planning (`buildOptions.withoutQueries`, the sole producer), so
 * its presence already means "scaffolded as a placeholder" and a planning check adds no protection
 * against badging a real panel. What it did add was a bug: pressing Build clears planning state
 * immediately, but the panels keep their seeded data until the build's first `APPLY_SPEC` lands
 * seconds later — so the badge vanished while the invented numbers were still on screen, which is
 * the one moment they can be mistaken for measurements.
 */
function PlanPlaceholderBadgeContent({ panel }: { panel: VizPanel }) {
  const { $data } = panel.useState();

  // Deliberately structural rather than `$data instanceof SceneDataNode`. The assistant plugin
  // scaffolds the preview and attaches the seeded data itself, and it does not treat
  // @grafana/scenes as a webpack external — so the SceneDataNode it constructs is a different
  // class object from this bundle's, and an instanceof check against it is always false. What
  // actually matters is the same either way: the panel is showing data that no query produced.
  //
  // A panel the user added by hand during planning has no data provider at all, so it is
  // correctly excluded — there is no number on it to be misread, and the dashed placeholder
  // border is the whole signal it needs.
  const showsDataFromNoQuery = Boolean($data) && !getQueryRunnerFor(panel);

  // Self-clearing, and per panel: the build rebuilds the scene from the applied spec, at which
  // point the panel has a real query runner (and this badge is no longer attached at all). A panel
  // the build failed to reach keeps its badge, which is correct — it is still showing sample data.
  if (!showsDataFromNoQuery) {
    return null;
  }

  return (
    <Badge
      color="orange"
      text={<Trans i18nKey="dashboard.plan-placeholder-badge.text">Sample data</Trans>}
      tooltip={t(
        'dashboard.plan-placeholder-badge.tooltip',
        'This is a plan, not a dashboard. The numbers shown are made up to illustrate the layout — build the plan to run real queries.'
      )}
    />
  );
}
