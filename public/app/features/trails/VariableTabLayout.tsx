import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  QueryVariable,
  SceneComponentProps,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { RadioButtonGroup, Tab, TabsBar, useStyles2 } from '@grafana/ui';

export interface VariableTabLayoutState extends SceneObjectState {
  variableName: string;
  body: SceneObject;
}

/**
 * Just a proof of concept example of a behavior
 */
export class VariableTabLayout extends SceneObjectBase<VariableTabLayoutState> {
  public onSplitChange = (split: boolean) => {
    if (this.state.body instanceof SplittableLayoutItem) {
      this.state.body.setState({ isSplit: split });
    }
  };

  public getSplitState(): { splittable: boolean; isSplit: boolean } {
    if (this.state.body instanceof SplittableLayoutItem) {
      return { splittable: true, isSplit: this.state.body.state.isSplit };
    }

    return { isSplit: false, splittable: false };
  }

  public static Component = ({ model }: SceneComponentProps<VariableTabLayout>) => {
    const { variableName, body } = model.useState();
    const bodyState = body.useState();
    const styles = useStyles2(getStyles);
    const variable = sceneGraph.lookupVariable(variableName, model);

    if (!variable) {
      return <div>Variable {variableName} not found</div>;
    }

    if (!(variable instanceof QueryVariable)) {
      return <div>Variable not QueryVariable</div>;
    }

    const { loading, options } = variable.useState();
    const radioOptions = [
      { value: false, label: 'Single graph' },
      { value: true, label: 'Split' },
    ];

    let { splittable, isSplit } = model.getSplitState();

    return (
      <div className={styles.container}>
        {loading && <div>Loading...</div>}
        <TabsBar>
          <div className={styles.tabHeading}>Breakdown by label</div>
          {options.map((option, index) => (
            <Tab
              key={index}
              label={option.label}
              active={option.value === variable.state.value}
              onChangeTab={() => variable.changeValueTo(option.value, option.label)}
            />
          ))}
          {splittable && (
            <div className={styles.tabControls}>
              <RadioButtonGroup options={radioOptions} value={isSplit} onChange={model.onSplitChange} />
            </div>
          )}
        </TabsBar>
        <div className={styles.content}>
          <body.Component model={body} />
        </div>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      marginLeft: theme.spacing(2),
      flexGrow: 1,
      display: 'flex',
      minHeight: '100%',
      flexDirection: 'column',
    }),
    content: css({
      flexGrow: 1,
      display: 'flex',
      paddingTop: theme.spacing(2),
    }),
    tabHeading: css({
      paddingRight: theme.spacing(2),
      fontWeight: theme.typography.fontWeightMedium,
    }),
    tabControls: css({
      flexGrow: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
    }),
  };
}

export interface SplittableLayoutItemState extends SceneObjectState {
  isSplit: boolean;
  single: SceneObject;
  split: SceneObject;
}

export class SplittableLayoutItem extends SceneObjectBase<SplittableLayoutItemState> {
  public static Component = ({ model }: SceneComponentProps<SplittableLayoutItem>) => {
    const { isSplit, split, single } = model.useState();

    return isSplit ? <split.Component model={split} /> : <single.Component model={single} />;
  };
}
