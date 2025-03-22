import { css } from '@emotion/css';
import { ReactNode } from 'react';

import { GrafanaTheme2, PanelData } from '@grafana/data';
import { SceneComponentProps, SceneDataProvider, sceneGraph } from '@grafana/scenes';
import { ConditionalRenderingDataKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { Stack, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { ResponsiveGridItem } from '../scene/layout-responsive-grid/ResponsiveGridItem';
import { RowItem } from '../scene/layout-rows/RowItem';

import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';
import { DeleteConditionButton } from './DeleteConditionButton';
import { handleDeleteNonGroupCondition } from './shared';

export type DataConditionValue = boolean;

type ConditionalRenderingDataState = ConditionalRenderingBaseState<DataConditionValue>;

export class ConditionalRenderingData extends ConditionalRenderingBase<ConditionalRenderingDataState> {
  public constructor(state: ConditionalRenderingDataState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    let panelDataProviders: SceneDataProvider[] = [];
    const item = this.getConditionalLogicRoot().parent;
    if (item instanceof ResponsiveGridItem) {
      const panelData = sceneGraph.getData(item.state.body);
      if (panelData) {
        panelDataProviders.push(panelData);
      }
    }
    // extract multiple panel data from RowItem
    if (item instanceof RowItem) {
      const panels = item.getLayout().getVizPanels();
      for (const panel of panels) {
        const panelData = sceneGraph.getData(panel);
        if (panelData) {
          panelDataProviders.push(panelData);
        }
      }
    }
    panelDataProviders.forEach((d) => {
      this._subs.add(
        d.subscribeToState(() => {
          this.getConditionalLogicRoot().notifyChange();
        })
      );
    });
  }

  public evaluate(): boolean {
    const { value } = this.state;

    // enable/disable condition
    if (!value) {
      return true;
    }

    let data: PanelData[] = [];

    // get ResponsiveGridItem or RowItem
    const item = this.getConditionalLogicRoot().parent;

    // extract single panel data from ResponsiveGridItem
    if (item instanceof ResponsiveGridItem) {
      const panelData = sceneGraph.getData(item.state.body).state.data;
      if (panelData) {
        data.push(panelData);
      }
    }

    // extract multiple panel data from RowItem
    if (item instanceof RowItem) {
      const panels = item.getLayout().getVizPanels();
      for (const panel of panels) {
        const panelData = sceneGraph.getData(panel).state.data;
        if (panelData) {
          data.push(panelData);
        }
      }
    }

    // early return if no panel data
    if (!data.length) {
      return false;
    }

    for (let panelDataIdx = 0; panelDataIdx < data.length; panelDataIdx++) {
      const series = data[panelDataIdx]?.series ?? [];

      for (let seriesIdx = 0; seriesIdx < series.length; seriesIdx++) {
        if (series[seriesIdx].length > 0) {
          return true;
        }
      }
    }

    return false;
  }

  public render(): ReactNode {
    return <ConditionalRenderingDataRenderer model={this} />;
  }

  public onDelete() {
    handleDeleteNonGroupCondition(this);
  }

  public serialize(): ConditionalRenderingDataKind {
    return {
      kind: 'ConditionalRenderingData',
      spec: {
        value: this.state.value,
      },
    };
  }
}

function ConditionalRenderingDataRenderer({ model }: SceneComponentProps<ConditionalRenderingData>) {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <p className={styles.text}>
        <Trans i18nKey="dashboard.conditional-rendering.data.text">Show when has data</Trans>
      </p>
      <DeleteConditionButton model={model} />
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  text: css({
    ...theme.typography.bodySmall,
    fontStyle: 'italic',
    margin: 0,
  }),
});
