import { Trans, t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase, VizPanel } from '@grafana/scenes';
import { Badge } from '@grafana/ui';

import { getQueryRunnerFor } from '../utils/getQueryRunnerFor';

import { isDashboardSceneLike } from './types/dashboard';

/**
 * Labels sample data on each panel, including after planning ends while the build
 * is still replacing placeholders. Use as a VizPanel titleItems entry.
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
 * Keep the panel state subscription unconditional by resolving the scene parent
 * in the outer renderer. Badge visibility follows the data provider because sample
 * data can remain after planning ends.
 */
function PlanPlaceholderBadgeContent({ panel }: { panel: VizPanel }) {
  const { $data } = panel.useState();

  // Use a structural check because the assistant bundles its own @grafana/scenes;
  // its SceneDataNode constructor differs from core's. Panels without a data provider
  // have no sample values to label.
  const showsDataFromNoQuery = Boolean($data) && !getQueryRunnerFor(panel);

  // Replacing the sample provider clears the badge per panel. Unbuilt panels keep it.
  if (!showsDataFromNoQuery) {
    return null;
  }

  return (
    <Badge
      color="orange"
      text={<Trans i18nKey="dashboard.plan-placeholder-badge.text">Sample data</Trans>}
      tooltip={t(
        'dashboard.plan-placeholder-badge.tooltip',
        'The numbers shown are sample data for illustration and do not come from real queries.'
      )}
    />
  );
}
