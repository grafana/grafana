import { toLonLat } from 'ol/proj';
import React, { FC, useMemo, useCallback } from 'react';

import { StandardEditorProps, SelectableValue } from '@grafana/data';
import { Button, InlineField, InlineFieldRow, RadioButtonGroup, Select, VerticalGroup } from '@grafana/ui';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

import { GeomapPanelOptions, MapViewConfig, GeomapInstanceState } from '../types';
import { centerPointRegistry, MapCenterID } from '../view';

export const MapViewEditor: FC<
  StandardEditorProps<MapViewConfig, unknown, GeomapPanelOptions, GeomapInstanceState>
> = ({ value, onChange, context }) => {
  const labelWidth = 10;

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
  const DataScopeOptions: Array<SelectableValue<DataScopeValues>> = ScopeOptions.map((r) => ({
    label: DataScopeLabels[r],
    value: r,
  }));

  // Populate layers as select options
  const layers: Array<SelectableValue<string>> = [];
  if (context.options && context.options.layers) {
    for (let i = 0; i < context.options.layers.length; i++) {
      layers.push({
        label: context.options.layers[i].name,
        value: context.options.layers[i].name,
        description: undefined,
      });
    }
  }

  const views = useMemo(() => {
    const ids: string[] = [];
    if (value?.id) {
      ids.push(value.id);
    } else {
      ids.push(centerPointRegistry.list()[0].id);
    }
    return centerPointRegistry.selectOptions(ids);
  }, [value?.id]);

  const onSetCurrentView = useCallback(() => {
    const map = context.instanceState?.map;
    if (map) {
      const view = map.getView();
      const coords = view.getCenter();
      if (coords) {
        const center = toLonLat(coords, view.getProjection());
        onChange({
          ...value,
          id: MapCenterID.Coordinates,
          lon: +center[0].toFixed(6),
          lat: +center[1].toFixed(6),
          zoom: +view.getZoom()!.toFixed(2),
        });
      }
    }
  }, [value, onChange, context.instanceState]);

  const onSelectView = useCallback(
    (selection: SelectableValue<string>) => {
      const v = centerPointRegistry.getIfExists(selection.value);
      if (v) {
        onChange({
          ...value,
          id: v.id,
          lat: v.lat ?? value?.lat,
          lon: v.lon ?? value?.lon,
          zoom: v.zoom ?? value?.zoom,
        });
      }
    },
    [value, onChange]
  );

  const onSelectLayer = useCallback(
    (selection: SelectableValue<string>) => {
      onChange({ ...value, layer: selection.value });
    },
    [value, onChange]
  );

  return (
    <>
      <InlineFieldRow>
        <InlineField label="View" labelWidth={labelWidth} grow={true}>
          <Select options={views.options} value={views.current} onChange={onSelectView} />
        </InlineField>
      </InlineFieldRow>
      {value?.id === MapCenterID.Coordinates && (
        <>
          <InlineFieldRow>
            <InlineField label="Latitude" labelWidth={labelWidth} grow={true}>
              <NumberInput
                value={value.lat}
                min={-90}
                max={90}
                step={0.001}
                onChange={(v) => {
                  onChange({ ...value, lat: v });
                }}
              />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField label="Longitude" labelWidth={labelWidth} grow={true}>
              <NumberInput
                value={value.lon}
                min={-180}
                max={180}
                step={0.001}
                onChange={(v) => {
                  onChange({ ...value, lon: v });
                }}
              />
            </InlineField>
          </InlineFieldRow>
        </>
      )}
      {value?.id === MapCenterID.Fit && (
        <>
          <InlineFieldRow>
            <InlineField label="Data" labelWidth={labelWidth} grow={true}>
              <RadioButtonGroup
                value={
                  value?.allLayers
                    ? DataScopeValues.all
                    : !value?.allLayers && value.lastOnly
                    ? DataScopeValues.last
                    : DataScopeValues.layer
                }
                options={DataScopeOptions}
                onChange={(v) => {
                  if (v !== DataScopeValues.all && !value.layer) {
                    onChange({
                      ...value,
                      allLayers: v === String(DataScopeValues.all),
                      lastOnly: v === String(DataScopeValues.last),
                      layer: layers[0].value,
                    });
                  } else {
                    onChange({
                      ...value,
                      allLayers: v === String(DataScopeValues.all),
                      lastOnly: v === String(DataScopeValues.last),
                    });
                  }
                }}
              ></RadioButtonGroup>
            </InlineField>
          </InlineFieldRow>
          {!value?.allLayers && (
            <InlineFieldRow>
              <InlineField label="Layer" labelWidth={labelWidth} grow={true}>
                <Select options={layers} onChange={onSelectLayer} placeholder={layers[0].label} />
              </InlineField>
            </InlineFieldRow>
          )}
          {!value?.lastOnly && (
            <InlineFieldRow>
              <InlineField
                label="Padding"
                labelWidth={labelWidth}
                grow={true}
                tooltip="sets padding in relative percent beyond data extent"
              >
                <NumberInput
                  value={value?.padding ?? 5}
                  min={0}
                  step={1}
                  onChange={(v) => {
                    onChange({ ...value, padding: v });
                  }}
                />
              </InlineField>
            </InlineFieldRow>
          )}
        </>
      )}

      <InlineFieldRow>
        <InlineField label={value?.id === MapCenterID.Fit ? 'Max Zoom' : 'Zoom'} labelWidth={labelWidth} grow={true}>
          <NumberInput
            value={value?.zoom ?? 1}
            min={1}
            max={18}
            step={0.01}
            onChange={(v) => {
              onChange({ ...value, zoom: v });
            }}
          />
        </InlineField>
      </InlineFieldRow>

      <VerticalGroup>
        <Button variant="secondary" size="sm" fullWidth onClick={onSetCurrentView}>
          <span>Use current map settings</span>
        </Button>
      </VerticalGroup>
    </>
  );
};
