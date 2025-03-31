import { useMemo } from 'react';

import { PanelData } from '@grafana/data';
import { SceneComponentProps, SceneDataProvider, sceneGraph } from '@grafana/scenes';
import { ConditionalRenderingDataKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { Combobox, ComboboxOption } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { AutoGridItem } from '../scene/layout-responsive-grid/ResponsiveGridItem';
import { RowItem } from '../scene/layout-rows/RowItem';

import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';

export type DataConditionValue = boolean;

type ConditionalRenderingDataState = ConditionalRenderingBaseState<DataConditionValue>;

export class ConditionalRenderingData extends ConditionalRenderingBase<ConditionalRenderingDataState> {
  public static Component = ConditionalRenderingDataRenderer;

  public get title(): string {
    return t('dashboard.conditional-rendering.data.label', 'Query result');
  }

  public constructor(state: ConditionalRenderingDataState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    let panelDataProviders: SceneDataProvider[] = [];

    const item = this.getItem();

    if (item instanceof AutoGridItem) {
      const panelData = sceneGraph.getData(item.state.body);

      if (panelData) {
        panelDataProviders.push(panelData);
      }
    } else if (item instanceof RowItem) {
      const panels = item.getLayout().getVizPanels();

      for (const panel of panels) {
        const panelData = sceneGraph.getData(panel);

        if (panelData) {
          panelDataProviders.push(panelData);
        }
      }
    }

    panelDataProviders.forEach((dataProvider) => {
      this._subs.add(dataProvider.subscribeToState(() => this.notifyChange()));
    });
  }

  public evaluate(): boolean {
    const { value } = this.state;

    if (!value) {
      return true;
    }

    let data: PanelData[] = [];

    const item = this.getItem();

    if (item instanceof AutoGridItem) {
      const panelData = sceneGraph.getData(item.state.body).state.data;
      if (panelData) {
        data.push(panelData);
      }
    } else if (item instanceof RowItem) {
      const panels = item.getLayout().getVizPanels();
      for (const panel of panels) {
        const panelData = sceneGraph.getData(panel).state.data;
        if (panelData) {
          data.push(panelData);
        }
      }
    }

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

  const enableConditionOptions: Array<ComboboxOption<1 | 0>> = useMemo(
    () => [
      { label: t('dashboard.conditional-rendering.data.enable', 'Has data'), value: 1 },
      { label: t('dashboard.conditional-rendering.data.disable', 'No data'), value: 0 },
    ],
    []
  );

  const enableConditionOption = useMemo(
    () => enableConditionOptions.find((option) => Boolean(option.value) === value) ?? enableConditionOptions[0],
    [enableConditionOptions, value]
  );

  return (
    <Combobox
      options={enableConditionOptions}
      value={enableConditionOption}
      onChange={({ value }) => model.setStateAndNotify({ value: Boolean(value) })}
    />
  );
}
