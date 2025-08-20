import { ReactElement, useMemo } from 'react';

import { LoadingState } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  SceneComponentProps,
  SceneDataProvider,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { ConditionalRenderingDataKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { Combobox, ComboboxOption } from '@grafana/ui';

import { dashboardEditActions } from '../../edit-pane/shared';
import { getLowerTranslatedObjectType, getObjectType } from '../object';

import { ConditionalRenderingConditionWrapper } from './ConditionalRenderingConditionWrapper';
import { ConditionalRenderingConditionsSerializerRegistryItem } from './serializers';
import { checkGroup, getObject } from './utils';

interface ConditionalRenderingDataState extends SceneObjectState {
  value: boolean;
  result: boolean | undefined;
}

export class ConditionalRenderingData extends SceneObjectBase<ConditionalRenderingDataState> {
  public static Component = ConditionalRenderingDataRenderer;

  public static serializer: ConditionalRenderingConditionsSerializerRegistryItem = {
    id: 'ConditionalRenderingData',
    name: 'Data',
    deserialize: this.deserialize,
  };

  private _dataProvider: SceneDataProvider | undefined = undefined;

  public constructor(state: ConditionalRenderingDataState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    this.forEachChild((child) => {
      if (!child.isActive) {
        this._subs.add(child.activate());
      }
    });

    this._dataProvider = this._getObjectDataProvider();

    if (!this._dataProvider) {
      return;
    }

    this._check();

    this._subs.add(this._dataProvider.subscribeToState(() => this._check()));
  }

  private _getObjectDataProvider(): SceneDataProvider | undefined {
    const object = getObject(this);

    if (!object) {
      return undefined;
    }

    let panel: VizPanel | undefined;

    for (const val of Object.values(object.state)) {
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

  private _check() {
    const result = this._evaluate();

    if (result !== this.state.result) {
      this.setState({ ...this.state, result });
      checkGroup(this);
    }
  }

  private _evaluate(): boolean | undefined {
    if (
      !this._dataProvider ||
      !this._dataProvider.state.data ||
      this._dataProvider.state.data.state === LoadingState.Loading ||
      this._dataProvider.state.data.state === LoadingState.NotStarted
    ) {
      return undefined;
    }

    const series = this._dataProvider?.state.data?.series ?? [];
    let hasData = false;

    for (let seriesIdx = 0; seriesIdx < series.length; seriesIdx++) {
      if (series[seriesIdx].length > 0) {
        hasData = true;
        break;
      }
    }

    // The logic here is pretty simple:
    // If value is true (meaning "has data"), then we check if the object has data
    // If value is false (meaning "no data"), then we check if the object doesn't have data
    return this.state.value === hasData;
  }

  public changeValue(value: boolean) {
    if (this.state.value !== value) {
      this.setState({ value });
      this._check();
    }
  }

  public render(): ReactElement {
    return <this.Component model={this} key={this.state.key} />;
  }

  public serialize(): ConditionalRenderingDataKind {
    return { kind: 'ConditionalRenderingData', spec: { value: this.state.value } };
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

  const objectType = getObjectType(model);

  return (
    <ConditionalRenderingConditionWrapper
      info={t(
        'dashboard.conditional-rendering.conditions.data.info',
        'Show or hide the {{type}} based on query results.',
        { type: getLowerTranslatedObjectType(objectType) }
      )}
      isObjectSupported={objectType === 'panel'}
      model={model}
      title={t('dashboard.conditional-rendering.conditions.data.label', 'Query result')}
    >
      <Combobox
        options={enableConditionOptions}
        value={enableConditionOption}
        onChange={({ value: newValue }) => {
          dashboardEditActions.edit({
            description: t('dashboard.edit-actions.edit-query-result-rule', 'Change query result rule'),
            source: model,
            perform: () => model.changeValue(Boolean(newValue)),
            undo: () => model.changeValue(value),
          });
        }}
      />
    </ConditionalRenderingConditionWrapper>
  );
}
