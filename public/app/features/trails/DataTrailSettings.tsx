import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Dropdown, Switch, ToolbarButton, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { MetricScene } from './MetricScene';
import { MetricSelectScene } from './MetricSelect/MetricSelectScene';
import { reportExploreMetrics } from './interactions';
import { getTrailFor } from './utils';

export interface DataTrailSettingsState extends SceneObjectState {
  stickyMainGraph?: boolean;
  isOpen?: boolean;
}

export class DataTrailSettings extends SceneObjectBase<DataTrailSettingsState> {
  constructor(state: Partial<DataTrailSettingsState>) {
    super({
      stickyMainGraph: state.stickyMainGraph ?? true,
      isOpen: state.isOpen ?? false,
    });
  }

  public onToggleStickyMainGraph = () => {
    const stickyMainGraph = !this.state.stickyMainGraph;
    reportExploreMetrics('settings_changed', { stickyMainGraph });
    this.setState({ stickyMainGraph });
  };

  public onToggleOpen = (isOpen: boolean) => {
    this.setState({ isOpen });
  };

  public onTogglePreviews = () => {
    const trail = getTrailFor(this);
    trail.setState({ showPreviews: !trail.state.showPreviews });
  };

  static Component = ({ model }: SceneComponentProps<DataTrailSettings>) => {
    const { stickyMainGraph, isOpen } = model.useState();
    const styles = useStyles2(getStyles);

    const trail = getTrailFor(model);

    const { showPreviews, topScene } = trail.useState();

    const renderPopover = () => {
      return (
        /* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
        <div className={styles.popover} onClick={(evt) => evt.stopPropagation()}>
          <div className={styles.heading}>Settings</div>
          {topScene instanceof MetricScene && (
            <div className={styles.options}>
              <div>
                <Trans i18nKey="trails.settings.always-keep-selected-metric-graph-in-view">
                  Always keep selected metric graph in-view
                </Trans>
              </div>
              <Switch value={stickyMainGraph} onChange={model.onToggleStickyMainGraph} />
            </div>
          )}
          {topScene instanceof MetricSelectScene && (
            <div className={styles.options}>
              <div>
                <Trans i18nKey="trails.settings.show-previews-of-metric-graphs">Show previews of metric graphs</Trans>
              </div>
              <Switch value={showPreviews} onChange={model.onTogglePreviews} />
            </div>
          )}
        </div>
      );
    };

    return (
      <Dropdown overlay={renderPopover} placement="bottom" onVisibleChange={model.onToggleOpen}>
        <ToolbarButton icon="cog" variant="canvas" isOpen={isOpen} />
      </Dropdown>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    popover: css({
      display: 'flex',
      padding: theme.spacing(2),
      flexDirection: 'column',
      background: theme.colors.background.primary,
      boxShadow: theme.shadows.z3,
      borderRadius: theme.shape.borderRadius(),
      border: `1px solid ${theme.colors.border.weak}`,
      zIndex: 1,
      marginRight: theme.spacing(2),
    }),
    heading: css({
      fontWeight: theme.typography.fontWeightMedium,
      paddingBottom: theme.spacing(2),
    }),
    options: css({
      display: 'grid',
      gridTemplateColumns: '1fr 50px',
      rowGap: theme.spacing(1),
      columnGap: theme.spacing(2),
    }),
  };
}
