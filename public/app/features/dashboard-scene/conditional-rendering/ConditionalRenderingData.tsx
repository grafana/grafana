import { useMemo } from 'react';

import { LoadingState } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps, SceneDataProvider, sceneGraph, VizPanel } from '@grafana/scenes';
import { ConditionalRenderingDataKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { Combobox, ComboboxOption } from '@grafana/ui';

import { dashboardEditActions } from '../edit-pane/shared';

import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';
import {
  ConditionalRenderingSerializerRegistryItem,
  ConditionEvaluationResult,
  DataConditionValue,
  ItemsWithConditionalRendering,
} from './types';
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

  public readonly renderHidden = true;

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

  private _dataProvider: SceneDataProvider | undefined = undefined;
  private _isItemSupported = true;

  public constructor(state: ConditionalRenderingDataState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    this._isItemSupported = this.isItemSupported();

    if (!this._isItemSupported) {
      return;
    }

    this._dataProvider = this._getItemDataProvider();

    if (!this._dataProvider) {
      return;
    }

    this._subs.add(this._dataProvider.subscribeToState(() => this.recalculateResult()));
  }

  public evaluate(): ConditionEvaluationResult {
    if (
      !this._isItemSupported ||
      !this._dataProvider ||
      !this._dataProvider.state.data ||
      this._dataProvider.state.data.state === LoadingState.Loading ||
      this._dataProvider.state.data.state === LoadingState.NotStarted
    ) {
      return undefined;
    }

    const hasData = this._hasData();

    // The logic here is pretty simple:
    // If value is true (meaning "has data"), then we check if the item has data
    // If value is false (meaning "no data"), then we check if the item doesn't have data
    return this.state.value === hasData;
  }

  public serialize(): ConditionalRenderingDataKind {
    return { kind: 'ConditionalRenderingData', spec: { value: this.state.value } };
  }

  private _getItemDataProvider(): SceneDataProvider | undefined {
    const item = this.getItem();

    let panel: VizPanel | undefined;

    for (const val of Object.values(item.state)) {
      if (val instanceof VizPanel) {
        panel = val;
        break;
      }
    }

    if (!panel) {
      return undefined;
    }

    return sceneGraph.getData(panel) ?? undefined;
  }

  private _hasData(): boolean {
    const series = this._dataProvider?.state.data?.series ?? [];

    for (let seriesIdx = 0; seriesIdx < series.length; seriesIdx++) {
      if (series[seriesIdx].length > 0) {
        return true;
      }
    }

    return false;
  }

  public static deserialize(model: ConditionalRenderingDataKind): ConditionalRenderingData {
    return new ConditionalRenderingData({ value: model.spec.value, result: undefined });
  }

  public static createEmpty(): ConditionalRenderingData {
    return new ConditionalRenderingData({ value: true, result: undefined });
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
          perform: () => model.setStateAndRecalculate({ value: Boolean(val) }),
          undo: () => model.setStateAndRecalculate({ value }),
        });
      }}
    />
  );
}
