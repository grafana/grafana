import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Dropdown, Switch, ToolbarButton, useStyles2 } from '@grafana/ui';

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
    this.setState({ stickyMainGraph: !this.state.stickyMainGraph });
  };

  public onToggleOpen = (isOpen: boolean) => {
    this.setState({ isOpen });
  };

  static Component = ({ model }: SceneComponentProps<DataTrailSettings>) => {
    const { stickyMainGraph, isOpen } = model.useState();
    const styles = useStyles2(getStyles);

    const renderPopover = () => {
      return (
        /* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
        <div className={styles.popover} onClick={(evt) => evt.stopPropagation()}>
          <div className={styles.heading}>Settings</div>
          <div className={styles.options}>
            <div>Always keep metrics graph in-view</div>
            <Switch value={stickyMainGraph} onChange={model.onToggleStickyMainGraph} />
          </div>
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
