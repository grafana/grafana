import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, VizPanel } from '@grafana/scenes';
import { Icon, PanelChrome, Tooltip, useStyles2 } from '@grafana/ui';
import { explicitlyControlledMigrationPanels } from 'app/features/dashboard/state/PanelModel';
import { isAngularDatasourcePluginAndNotHidden } from 'app/features/plugins/angularDeprecation/utils';

import { getPanelIdForVizPanel } from '../utils/utils';

export class AngularDeprecation extends SceneObjectBase {
  static Component = AngularDeprecationRenderer;

  constructor() {
    super({});
    this.addActivationHandler(this.onActivate);
  }

  private onActivate = () => {
    const panel = this.parent;
    if (!panel || !(panel instanceof VizPanel)) {
      throw new Error('PanelNotices can be used only as title items for VizPanel');
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

function AngularDeprecationRenderer({ model }: SceneComponentProps<AngularDeprecation>) {
  const panel = model.getPanel();

  const styles = useStyles2(getStyles);
  if (!panel) {
    return null;
  }

  //panel.isAngularPlugin()
  const pluginType = panel.state.pluginId;
  console.log('panel from angularDeprecation', panel);
  const isAngularDatasource = panel.datasource?.uid
    ? isAngularDatasourcePluginAndNotHidden(panel.datasource?.uid)
    : false;
  const isAngularPanel = isPanelAngularPlugin(panel) && !panel.plugin?.meta.angular?.hideDeprecation;
  const showAngularNotice =
    (config.featureToggles.angularDeprecationUI ?? false) && (isAngularDatasource || isAngularPanel);

  if (showAngularNotice) {
    //original code ${pluginType(angularNotice)}
    const message = `This ${pluginType} requires Angular (deprecated).`;
    const angularNoticeTooltip = (
      <Tooltip content={message}>
        <PanelChrome.TitleItem className={styles.angularNotice} data-testid="angular-deprecation-icon">
          <Icon name="exclamation-triangle" size="md" />
        </PanelChrome.TitleItem>
      </Tooltip>
    );
    return angularNoticeTooltip;
  }
  return null;
}

export function isPanelAngularPlugin(panel: VizPanel) {
  return (
    (config.panels[panel.state.pluginId]?.angular?.detected ||
      explicitlyControlledMigrationPanels.includes(panel.state.pluginId)) &&
    !config.panels[panel.state.pluginId]?.angular?.hideDeprecation
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    angularNotice: css({
      color: theme.colors.warning.text,
    }),
  };
}
