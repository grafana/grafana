import { Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, VizPanel } from '@grafana/scenes';
import { Icon, PanelChrome, Text } from '@grafana/ui';

import { CustomTimeRangeCompare } from './CustomTimeRangeCompare';

/**
 * Displays the current time comparison selection as subdued text in the panel title.
 */
export class PanelTimeCompareLabel extends SceneObjectBase {
  static Component = PanelTimeCompareLabelRenderer;

  constructor() {
    super({});
    this.addActivationHandler(this.onActivate);
  }

  private onActivate = () => {
    const panel = this.parent;
    if (!panel || !(panel instanceof VizPanel)) {
      throw new Error('PanelTimeCompareLabel can be used only as title items for VizPanel');
    }
  };

  public getPanel() {
    const panel = this.parent;

    if (panel && panel instanceof VizPanel) {
      return panel;
    }

    return null;
  }
}

function PanelTimeCompareLabelRenderer({ model }: SceneComponentProps<PanelTimeCompareLabel>) {
  const panel = model.getPanel();

  if (!panel || !config.featureToggles.timeComparison) {
    return null;
  }

  const headerActions = panel.state.headerActions;
  if (!headerActions || !Array.isArray(headerActions)) {
    return null;
  }

  const timeCompare = headerActions.find((action) => action instanceof CustomTimeRangeCompare);
  if (!timeCompare) {
    return null;
  }

  const { compareWith, compareOptions } = timeCompare.useState();

  if (!compareWith || compareWith === '__noPeriod') {
    return null;
  }

  const option = compareOptions.find((opt) => opt.value === compareWith);
  const label = option?.label || compareWith;

  return (
    <PanelChrome.TitleItem>
      <Icon name="clock-nine" size="sm" />
      <Text variant="bodySmall">
        <Trans i18nKey="dashboard-scene.panel-time-compare-label.comparison-text">{{ label }} (comparison)</Trans>
      </Text>
    </PanelChrome.TitleItem>
  );
}
