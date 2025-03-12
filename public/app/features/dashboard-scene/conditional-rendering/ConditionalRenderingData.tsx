import { ReactNode, useMemo } from 'react';

import { PanelData, SelectableValue } from '@grafana/data';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { ConditionalRenderingDataKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { RadioButtonGroup, Stack } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ResponsiveGridItem } from '../scene/layout-responsive-grid/ResponsiveGridItem';
import { RowItem } from '../scene/layout-rows/RowItem';

import { ConditionHeader } from './ConditionHeader';
import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';
import { handleDeleteNonGroupCondition } from './shared';
export type DataConditionValue = boolean;

interface ConditionalRenderingDataState extends ConditionalRenderingBaseState<DataConditionValue> {}

export class ConditionalRenderingData extends ConditionalRenderingBase<ConditionalRenderingDataState> {
  public get title(): string {
    return t('dashboard.conditional-rendering.data.label', 'Data');
  }

  public evaluate(): boolean {
    const { value } = this.state;

    // enable/disable condition
    if (!value) {
      return true;
    }

    let data: PanelData[] = [];
    let hasData = false;

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

    // outer loop for PanelData[]
    outer: for (let p = 0; p < data.length; p++) {
      const panelData = data[p];

      if (!panelData?.series.length) {
        continue outer;
      }

      // inner loop for PanelData.series
      for (let i = 0; i < panelData.series.length; i++) {
        // early break if any data is detected
        if (hasData) {
          break outer;
        }
        if (panelData?.series[i].length) {
          hasData = true;
        }
      }
    }

    return hasData;
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
