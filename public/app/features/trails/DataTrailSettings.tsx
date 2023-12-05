import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Dropdown, Switch, ToolbarButton, useStyles2 } from '@grafana/ui';

export interface DataTrailSettingsState extends SceneObjectState {
  showQuery?: boolean;
  showAdvanced?: boolean;
  multiValueVars?: boolean;
  isOpen?: boolean;
}

export class DataTrailSettings extends SceneObjectBase<DataTrailSettingsState> {
  constructor(state: Partial<DataTrailSettingsState>) {
    super({
      showQuery: state.showQuery ?? false,
      showAdvanced: state.showAdvanced ?? false,
      isOpen: state.isOpen ?? false,
    });
  }

  public onToggleShowQuery = () => {
    this.setState({ showQuery: !this.state.showQuery });
  };

  public onToggleAdvanced = () => {
    this.setState({ showAdvanced: !this.state.showAdvanced });
  };

  public onToggleMultiValue = () => {
    this.setState({ multiValueVars: !this.state.multiValueVars });
  };

  public onToggleOpen = (isOpen: boolean) => {
    this.setState({ isOpen });
  };

  static Component = ({ model }: SceneComponentProps<DataTrailSettings>) => {
    const { showQuery, showAdvanced, multiValueVars, isOpen } = model.useState();
    const styles = useStyles2(getStyles);

    const renderPopover = () => {
      return (
        /* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
        <div className={styles.popover} onClick={(evt) => evt.stopPropagation()}>
          <div className={styles.heading}>Settings</div>
          <div className={styles.options}>
            <div>Multi value variables</div>
            <Switch value={multiValueVars} onChange={model.onToggleMultiValue} />
            <div>Advanced options</div>
            <Switch value={showAdvanced} onChange={model.onToggleAdvanced} />
            <div>Show query</div>
            <Switch value={showQuery} onChange={model.onToggleShowQuery} />
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
