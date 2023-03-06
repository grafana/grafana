import { toLonLat } from 'ol/proj';
import React, { useMemo, useCallback } from 'react';

import { StandardEditorProps, SelectableValue } from '@grafana/data';
import { Button, InlineField, InlineFieldRow, Select, VerticalGroup } from '@grafana/ui';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

import { PanelOptions, MapViewConfig, GeomapInstanceState } from '../types';
import { centerPointRegistry, MapCenterID } from '../view';

import { CoordinatesMapViewEditor } from './CoordinatesMapViewEditor';
import { FitMapViewEditor } from './FitMapViewEditor';

export const MapViewEditor = ({
  value,
  onChange,
  context,
}: StandardEditorProps<MapViewConfig, unknown, PanelOptions, GeomapInstanceState>) => {
  const labelWidth = 10;

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

  return (
    <>
      <InlineFieldRow>
        <InlineField label="View" labelWidth={labelWidth} grow={true}>
          <Select options={views.options} value={views.current} onChange={onSelectView} />
        </InlineField>
      </InlineFieldRow>
      {value.id === MapCenterID.Coordinates && (
        <CoordinatesMapViewEditor labelWidth={labelWidth} value={value} onChange={onChange} />
      )}
      {value.id === MapCenterID.Fit && (
        <FitMapViewEditor labelWidth={labelWidth} value={value} onChange={onChange} context={context} />
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
