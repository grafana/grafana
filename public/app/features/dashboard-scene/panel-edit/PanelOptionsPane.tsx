import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { Field, Input, useStyles2 } from '@grafana/ui';

export interface PanelOptionsPaneState extends SceneObjectState {}

export class PanelOptionsPane extends SceneObjectBase<PanelOptionsPaneState> {
  public panel: VizPanel;

  public constructor(panel: VizPanel) {
    super({});

    this.panel = panel;
  }

  static Component = ({ model }: SceneComponentProps<PanelOptionsPane>) => {
    const { panel } = model;
    const { title } = panel.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.box}>
        <Field label="Title">
          <Input value={title} onChange={(evt) => panel.setState({ title: evt.currentTarget.value })} />
        </Field>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    box: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(2),
      flexBasis: '100%',
      flexGrow: 1,
      minHeight: 0,
    }),
  };
}
