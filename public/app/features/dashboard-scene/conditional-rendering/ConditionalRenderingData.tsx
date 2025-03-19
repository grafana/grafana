import { ReactNode, useMemo } from 'react';

import { PanelData, SelectableValue } from '@grafana/data';
import { SceneComponentProps, SceneDataProvider, sceneGraph } from '@grafana/scenes';
import { ConditionalRenderingDataKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { RadioButtonGroup, Stack } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ResponsiveGridItem } from '../scene/layout-responsive-grid/ResponsiveGridItem';
import { RowItem } from '../scene/layout-rows/RowItem';

import { ConditionHeader } from './ConditionHeader';
import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';
import { handleDeleteNonGroupCondition } from './shared';

export type DataConditionValue = boolean;

type ConditionalRenderingDataState = ConditionalRenderingBaseState<DataConditionValue>;

export class ConditionalRenderingData extends ConditionalRenderingBase<ConditionalRenderingDataState> {
  public get title(): string {
    return t('dashboard.conditional-rendering.data.label', 'Data');
  }

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
  const { value } = model.useState();

  const enableConditionOptions: Array<SelectableValue<true | false>> = useMemo(
    () => [
      { label: t('dashboard.conditional-rendering.data.enable', 'Enable'), value: true },
      { label: t('dashboard.conditional-rendering.data.disable', 'Disable'), value: false },
    ],
    []
  );

  return (
    <Stack direction="column">
      <ConditionHeader title={model.title} onDelete={() => model.onDelete()} />
      <RadioButtonGroup
        fullWidth
        options={enableConditionOptions}
        value={value}
        onChange={(value) => model.setStateAndNotify({ value: value })}
      />
    </Stack>
  );
}
