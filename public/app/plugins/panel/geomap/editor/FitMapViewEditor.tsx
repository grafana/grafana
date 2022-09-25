import React, { useCallback, useMemo } from 'react';

import { SelectableValue, StandardEditorContext } from '@grafana/data';
import { InlineFieldRow, InlineField, RadioButtonGroup, Select } from '@grafana/ui';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

import { GeomapInstanceState, GeomapPanelOptions, MapViewConfig } from '../types';

type Props = {
  labelWidth: number;
  value: MapViewConfig;
  onChange: (value?: MapViewConfig | undefined) => void;
  context: StandardEditorContext<GeomapPanelOptions, GeomapInstanceState>;
};

// Data scope options for 'Fit to data'
enum DataScopeValues {
  all = 'all',
  layer = 'layer',
  last = 'last',
}
enum DataScopeLabels {
  all = 'All layers',
  layer = 'Layer',
  last = 'Last value',
}

const ScopeOptions = Object.values(DataScopeValues);

const DataScopeOptions: Array<SelectableValue<DataScopeValues>> = ScopeOptions.map((dataScopeOption) => ({
  label: DataScopeLabels[dataScopeOption],
  value: dataScopeOption,
}));

export const FitMapViewEditor = ({ labelWidth, value, onChange, context }: Props) => {
  const layers = useMemo(() => {
    if (context.options?.layers) {
      return context.options.layers.map((layer) => ({
        label: layer.name,
        value: layer.name,
        description: undefined,
      }));
    }
    return [];
  }, [context.options?.layers]);

  const onSelectLayer = useCallback(
    (selection: SelectableValue<string>) => {
      onChange({ ...value, layer: selection.value });
    },
    [value, onChange]
  );

  const allLayersEditorFragment = (
    <InlineFieldRow>
      <InlineField label="Layer" labelWidth={labelWidth} grow={true}>
        <Select options={layers} onChange={onSelectLayer} placeholder={layers[0]?.label} />
      </InlineField>
    </InlineFieldRow>
  );

  const onChangePadding = (padding: number | undefined) => {
    onChange({ ...value, padding: padding });
  };

  const lastOnlyEditorFragment = (
    <InlineFieldRow>
      <InlineField
        label="Padding"
        labelWidth={labelWidth}
        grow={true}
        tooltip="sets padding in relative percent beyond data extent"
      >
        <NumberInput value={value?.padding ?? 5} min={0} step={1} onChange={onChangePadding} />
      </InlineField>
    </InlineFieldRow>
  );

  const currentDataScope = value.allLayers
    ? DataScopeValues.all
    : !value.allLayers && value.lastOnly
    ? DataScopeValues.last
    : DataScopeValues.layer;

  const onDataScopeChange = (dataScope: DataScopeValues) => {
    if (dataScope !== DataScopeValues.all && !value.layer) {
      onChange({
        ...value,
        allLayers: dataScope === String(DataScopeValues.all),
        lastOnly: dataScope === String(DataScopeValues.last),
        layer: layers[0].value,
      });
    } else {
      onChange({
        ...value,
        allLayers: dataScope === String(DataScopeValues.all),
        lastOnly: dataScope === String(DataScopeValues.last),
      });
    }
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Data" labelWidth={labelWidth} grow={true}>
          <RadioButtonGroup
            value={currentDataScope}
            options={DataScopeOptions}
            onChange={onDataScopeChange}
          ></RadioButtonGroup>
        </InlineField>
      </InlineFieldRow>
      {!value?.allLayers && allLayersEditorFragment}
      {!value?.lastOnly && lastOnlyEditorFragment}
    </>
  );
};
