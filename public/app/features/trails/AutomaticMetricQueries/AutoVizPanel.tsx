import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneObjectState, SceneObjectBase, SceneComponentProps, VizPanel, SceneQueryRunner } from '@grafana/scenes';
import { Field, RadioButtonGroup, useStyles2, Stack } from '@grafana/ui';

import { trailDS } from '../shared';
import { getTrailSettings } from '../utils';

import { AutoQueryInfo, AutoQueryDef } from './types';

export interface AutoVizPanelState extends SceneObjectState {
  panel?: VizPanel;
  autoQuery: AutoQueryInfo;
  queryDef?: AutoQueryDef;
}

export class AutoVizPanel extends SceneObjectBase<AutoVizPanelState> {
  constructor(state: AutoVizPanelState) {
    super(state);

    if (!state.panel) {
      this.setState({
        panel: this.getVizPanelFor(state.autoQuery.main),
        queryDef: state.autoQuery.main,
      });
    }
  }

  private getQuerySelector(def: AutoQueryDef) {
    const variants = this.state.autoQuery.variants;

    if (variants.length === 0) {
      return;
    }

    const options = variants.map((q) => ({ label: q.variant, value: q.variant }));

    return <RadioButtonGroup size="sm" options={options} value={def.variant} onChange={this.onChangeQuery} />;
  }

  public onChangeQuery = (variant: string) => {
    const def = this.state.autoQuery.variants.find((q) => q.variant === variant)!;

    this.setState({
      panel: this.getVizPanelFor(def),
      queryDef: def,
    });
  };

  private getVizPanelFor(def: AutoQueryDef) {
    return def
      .vizBuilder(def)
      .setData(
        new SceneQueryRunner({
          datasource: trailDS,
          maxDataPoints: 500,
          queries: def.queries,
        })
      )
      .setHeaderActions(this.getQuerySelector(def))
      .build();
  }

  public static Component = ({ model }: SceneComponentProps<AutoVizPanel>) => {
    const { panel, queryDef } = model.useState();
    const { showQuery } = getTrailSettings(model).useState();
    const styles = useStyles2(getStyles);

    if (!panel) {
      return;
    }

    if (!showQuery) {
      return <panel.Component model={panel} />;
    }

    return (
      <div className={styles.wrapper}>
        <Stack gap={2}>
          <Field label="Query">
            <div>{queryDef && queryDef.queries.map((query, index) => <div key={index}>{query.expr}</div>)}</div>
          </Field>
        </Stack>
        <div className={styles.panel}>
          <panel.Component model={panel} />
        </div>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
    }),
    panel: css({
      position: 'relative',
      flexGrow: 1,
    }),
  };
}
