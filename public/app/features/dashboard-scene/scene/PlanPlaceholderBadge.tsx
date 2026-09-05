import { Trans, t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase, VizPanel } from '@grafana/scenes';
import { Badge } from '@grafana/ui';

import { findDashboardSceneFor, getQueryRunnerFor } from '../utils/utils';

import { type DashboardScene } from './DashboardScene';

/**
 * Marks a panel in a plan preview as showing sample data rather than query results.
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
  const dashboard = findDashboardSceneFor(model);

  if (!panel || !dashboard) {
    return null;
  }

  return <PlanPlaceholderBadgeContent panel={panel} dashboard={dashboard} />;
}

/**
 * Split from the renderer so the state subscriptions are unconditional: whether the badge has a
 * panel and a dashboard to read is settled by the scene graph, not by React.
 */
function PlanPlaceholderBadgeContent({ panel, dashboard }: { panel: VizPanel; dashboard: DashboardScene }) {
  // Subscribed rather than read once: the badge has to disappear the moment the plan is built,
  // even in the case where the built dashboard reuses the very panel objects it previewed.
  const { planning } = dashboard.useState();
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

  if (!planning || !showsDataFromNoQuery) {
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
