import { toLonLat } from 'ol/proj';
import { useMemo, useCallback } from 'react';

import { StandardEditorProps, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, InlineField, InlineFieldRow, Select, Stack } from '@grafana/ui';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

import { Options, MapViewConfig, GeomapInstanceState } from '../types';
import { centerPointRegistry, MapCenterID } from '../view';

import { CoordinatesMapViewEditor } from './CoordinatesMapViewEditor';
import { FitMapViewEditor } from './FitMapViewEditor';

export const MapViewEditor = ({
  value,
  onChange,
  context,
}: StandardEditorProps<MapViewConfig, unknown, Options, GeomapInstanceState>) => {
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
        <InlineField label={t('geomap.map-view-editor.label-view', 'View')} labelWidth={labelWidth} grow={true}>
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
        <InlineField
          label={
            value?.id === MapCenterID.Fit
              ? t('geomap.map-view-editor.label-max-zoom', 'Max Zoom')
              : t('geomap.map-view-editor.label-zoom', 'Zoom')
          }
          labelWidth={labelWidth}
          grow={true}
        >
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

      <Stack direction="column">
        <Button variant="secondary" size="sm" fullWidth onClick={onSetCurrentView}>
          <span>
            <Trans i18nKey="geomap.map-view-editor.use-current-map-settings">Use current map settings</Trans>
          </span>
        </Button>
      </Stack>
    </>
  );
};
