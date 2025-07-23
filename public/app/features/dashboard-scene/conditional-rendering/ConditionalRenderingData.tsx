import { useMemo } from 'react';

import { PanelData } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { ConditionalRenderingDataKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { Combobox, ComboboxOption } from '@grafana/ui';

import { dashboardEditActions } from '../edit-pane/shared';
import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';

import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';
import { ConditionalRenderingSerializerRegistryItem, DataConditionValue, ItemsWithConditionalRendering } from './types';
import { translatedItemType } from './utils';

type ConditionalRenderingDataState = ConditionalRenderingBaseState<DataConditionValue>;

export class ConditionalRenderingData extends ConditionalRenderingBase<ConditionalRenderingDataState> {
  public static Component = ConditionalRenderingDataRenderer;

  public static serializer: ConditionalRenderingSerializerRegistryItem = {
    id: 'ConditionalRenderingData',
    name: 'Data',
    deserialize: this.deserialize,
  };

  public readonly supportedItemTypes: ItemsWithConditionalRendering[] = ['panel'];

  public get title(): string {
    return t('dashboard.conditional-rendering.conditions.data.label', 'Query result');
  }

  public get info(): string {
    return t(
      'dashboard.conditional-rendering.conditions.data.info',
      'Show or hide the {{type}} based on query results.',
      { type: translatedItemType(this.getItemType()) }
    );
  }

  public constructor(state: ConditionalRenderingDataState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    if (!this.isItemSupported()) {
      return;
    }

    const item = this.getItem();

    if (item instanceof AutoGridItem) {
      const dataProvider = sceneGraph.getData(item.state.body);

      if (!dataProvider) {
        return;
      }

      this._subs.add(dataProvider.subscribeToState(() => this.notifyChange()));
    }
  }

  public evaluate(): boolean {
    if (!this.isItemSupported()) {
      return true;
    }

    const hasData = this._hasData();
    return (this.state.value && hasData) || (!this.state.value && !hasData);
  }

  public serialize(): ConditionalRenderingDataKind {
    return { kind: 'ConditionalRenderingData', spec: { value: this.state.value } };
  }

  private _hasData(): boolean {
    const item = this.getItem();

    let data: PanelData | undefined;

    if (item instanceof AutoGridItem) {
      data = sceneGraph.getData(item.state.body).state.data;
    }

    if (!data) {
      return false;
    }

    const series = data?.series ?? [];

    for (let seriesIdx = 0; seriesIdx < series.length; seriesIdx++) {
      if (series[seriesIdx].length > 0) {
        return true;
      }
    }

    return false;
  }

  public static deserialize(model: ConditionalRenderingDataKind): ConditionalRenderingData {
    return new ConditionalRenderingData({ value: model.spec.value });
  }

  public static createEmpty(): ConditionalRenderingData {
    return new ConditionalRenderingData({ value: true });
  }
}

function ConditionalRenderingDataRenderer({ model }: SceneComponentProps<ConditionalRenderingData>) {
  const { value } = model.useState();

  const enableConditionOptions: Array<ComboboxOption<1 | 0>> = useMemo(
    () => [
      { label: t('dashboard.conditional-rendering.conditions.data.enable', 'Has data'), value: 1 },
      { label: t('dashboard.conditional-rendering.conditions.data.disable', 'No data'), value: 0 },
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
      onChange={({ value: val }) => {
        dashboardEditActions.edit({
          description: t('dashboard.edit-actions.edit-query-result-rule', 'Change query result rule'),
          source: model,
          perform: () => model.setStateAndNotify({ value: Boolean(val) }),
          undo: () => model.setStateAndNotify({ value }),
        });
      }}
    />
  );
}
