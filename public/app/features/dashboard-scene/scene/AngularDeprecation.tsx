import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneComponentProps, SceneGridItemLike, SceneObjectBase, VizPanel } from '@grafana/scenes';
import { Icon, PanelChrome, Tooltip, useStyles2 } from '@grafana/ui';
import { explicitlyControlledMigrationPanels } from 'app/features/dashboard/state/PanelModel';
import { isAngularDatasourcePluginAndNotHidden } from 'app/features/plugins/angularDeprecation/utils';

import { getQueryRunnerFor } from '../utils/utils';

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

  const showAngularNotice = shouldShowAngularNotice(panel);
  if (showAngularNotice) {
    const pluginTypeNotice = getPluginTypeNotice(isGridPanelAngularDatasource(panel), isGridPanelAngularPlugin(panel));
    const message = `This ${pluginTypeNotice} requires Angular (deprecated).`;
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

export function getPluginTypeNotice(isAngularDatasource: boolean, isAngularPanel: boolean) {
  if (isAngularPanel) {
    return 'panel';
  }
  if (isAngularDatasource) {
    return 'data source';
  }
  return 'panel or data source';
}

export function isGridPanelAngularPlugin(gridItem: SceneGridItemLike) {
  //check if panel is library panel
  if (gridItem instanceof VizPanel) {
    return (
      (config.panels[gridItem.state.pluginId]?.angular?.detected ||
        explicitlyControlledMigrationPanels.includes(gridItem.state.pluginId)) &&
      !config.panels[gridItem.state.pluginId]?.angular?.hideDeprecation
    );
  }
  return false;
}

export function isGridPanelAngularDatasource(gridItem: SceneGridItemLike) {
  if (gridItem instanceof VizPanel) {
    const queryRunner = getQueryRunnerFor(gridItem);
    const datasource = queryRunner?.state.datasource;

    return datasource?.uid ? isAngularDatasourcePluginAndNotHidden(datasource?.uid) : false;
  }
  return false;
}

export function shouldShowAngularNotice(panel: VizPanel) {
  return (
    (config.featureToggles.angularDeprecationUI ?? false) &&
    (isGridPanelAngularDatasource(panel) || isGridPanelAngularPlugin(panel))
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    angularNotice: css({
      color: theme.colors.warning.text,
    }),
  };
}
