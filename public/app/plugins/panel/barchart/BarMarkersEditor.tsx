import { css } from '@emotion/css';
import { useState } from 'react';

import { StandardEditorProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Field, InlineField, Input, Label, Combobox, ComboboxOption, useTheme2, Slider } from '@grafana/ui';

import { ColorPicker } from '../../../../../packages/grafana-ui/src/components/ColorPicker/ColorPicker';
import { hoverColor } from '../../../../../packages/grafana-ui/src/themes/mixins';

import { BarMarkerOpts, Marker } from './markerTypes';

export const BarMarkersEditor = (props: StandardEditorProps<Marker[]>) => {
  const theme = useTheme2();

  let [markers, setMarkers] = useState<Marker[]>(props.value || []);

  const handleRemoveMarker = (id: number) => {
    const updatedMarkers = markers.filter((marker: Marker) => marker.id !== id);
    setMarkers(updatedMarkers);
    props.onChange(updatedMarkers);
  };

  const handleAddMarker = () => {
    let newId = Math.max(...markers.map(m => m.id), 0) + 1;

    const newMarker: Marker = {
      id: newId,
      targetField: '',
      dataField: '',
      opts: {
        label: `Marker ${markers.length + 1}`,
        color: 'rgb(184, 119, 217)',
        shape: 'line',
        width: 1,
        isRotated: false,
        opacity: 0.7,
      },
    };
    const updatedMarkers = [...markers, newMarker];
    setMarkers(updatedMarkers);
    props.onChange(updatedMarkers);
  };

  const fields = props.context?.data[0]?.fields ?? [];
  const xAxis = props.context?.options?.xField;
  let xFieldIdx = 0;
  if (xAxis) {
    xFieldIdx = fields.findIndex((f) => f.name === xAxis);
  }
  let yFieldOptions: Array<ComboboxOption<string | number>> = [];
  for (let i = 0; i < fields.length; i++) {
    if (i === xFieldIdx) {
      continue;
    }
    if (fields) {
      yFieldOptions.push({ label: fields[i].name ?? `Field ${i}`, value: fields[i].name ?? i });
    }
  }

  // Update a field in marker.opts
  const handleOptsSettingChange = (id: number, field: keyof BarMarkerOpts, newValue: string | number | undefined) => {
    const updatedMarkers = markers.map((marker: Marker) =>
      marker.id === id ? { ...marker, opts: { ...marker.opts, [field]: newValue } } : marker
    );
    setMarkers(updatedMarkers);
    props.onChange(updatedMarkers);
  };

  const handleSettingChange = (id: number, field: keyof Marker, newValue: string | number | undefined) => {
    const updatedMarkers = markers.map((marker: Marker) =>
      marker.id === id ? { ...marker, [field]: newValue } : marker
    );
    setMarkers(updatedMarkers);
    props.onChange(updatedMarkers);
  };

  const shapeOptions: Array<ComboboxOption<string>> = [
    { label: 'Circle', value: 'circle' },
    { label: 'Cross', value: 'cross' },
    { label: 'Line', value: 'line' },
    { label: 'Star', value: 'star' },
  ];

  return (
    <div>
      <Button
        fullWidth={true}
        onClick={handleAddMarker}
        className={css({
          backgroundColor: theme.colors.secondary.main,
          color: theme.colors.text.primary,
          '&:hover': {
            backgroundColor: hoverColor(theme.colors.action.hover, theme),
          },
        })}
      >
        {t('barchart.barmarkers-editor.add-marker', '+ Add marker')}
      </Button>

      {markers.map((marker: Marker) => (
        <div
          key={marker.id}
          style={{
            marginTop: '16px',
            border: '1px solid ' + theme.colors.border.medium,
            padding: '16px',
            borderRadius: '4px',
            position: 'relative',
            display: 'no-flex',
            alignContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            alignItems: 'center',
            minWidth: '0',
            minHeight: '300px',
          }}
        >
          <div style={{ minWidth: '120px', padding: '5px' }}>
            <InlineField label={t('barchart.barmarkers-editor.marker-title', 'Title')}>
              <div style={{ maxWidth: '160px' }}>
                <Input
                  value={marker.opts.label ?? `Marker ${marker.id}`}
                  onChange={(e) => handleOptsSettingChange(marker.id, 'label', (e.target as HTMLInputElement).value)}
                  placeholder={t('barchart.barmarkers-editor.marker-title-placeholder', `Marker ${marker.id}`)}
                />
              </div>
            </InlineField>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className={css({
              position: 'absolute',
              top: '25px',
              right: '10px',
              padding: '8px',
              backgroundColor: theme.colors.background.primary,
              '&:hover': {
                backgroundColor: theme.colors.secondary.main,
              },
            })}
            onClick={() => handleRemoveMarker(marker.id)}
          >
            {t('barchart.barmarkers-editor.remove-marker', 'X')}
          </Button>

          <div style={{ minWidth: '120px', padding: '5px' }}>
            <Field label={t('barchart.barmarkers-editor.y-axis', 'Target Field')}>
              <Combobox
                options={yFieldOptions}
                value={marker.targetField ?? ''}
                onChange={(v) => handleSettingChange(marker.id, 'targetField', v.value ?? '')}
                placeholder={t('barchart.barmarkers-editor.y-axis-placeholder', 'Select Y-Axis value')}
              />
            </Field>
          </div>
          <div style={{ minWidth: '120px', padding: '5px' }}>
            <Field label={t('barchart.barmarkers-editor.y-axis', 'Data Input')}>
              <Combobox
                options={yFieldOptions}
                value={marker.dataField ?? ''}
                onChange={(v) => handleSettingChange(marker.id, 'dataField', v.value ?? '')}
                placeholder={t('barchart.barmarkers-editor.y-axis-placeholder', 'Select Y-Axis value')}
              />
            </Field>
          </div>
          <div style={{ minWidth: '120px', padding: '5px', paddingBottom: '10px' }}>
            <Label>{t('barchart.barmarkers-editor.color', 'Color')}</Label>
            <ColorPicker
              color={marker.opts.color || 'rgb(184, 119, 217)'}
              onChange={(color: string) => handleOptsSettingChange(marker.id, 'color', color)}
            />
          </div>
          <div style={{ minWidth: '120px', padding: '5px' }}>
            <Field label={t('barchart.barmarkers-editor.shape', 'Shape')}>
              <Combobox
                options={shapeOptions}
                value={marker.opts.shape ?? 'line'}
                onChange={(v) => handleOptsSettingChange(marker.id, 'shape', v.value!)}
              />
            </Field>
          </div>
          <div>
            <Field label={t('barchart.barmarkers-editor.width', 'Size')}>
              <Slider
                included
                min={0.01}
                max={2}
                step={0.01}
                value={marker.opts.width ?? 1}
                onChange={(v) => handleOptsSettingChange(marker.id, 'width', typeof v === 'number' ? v : v[0])}
                marks={{ 0.01: '0.01', 2: '2' }}
              />
            </Field>
          </div>
          <div>
            <Field label={t('barchart.barmarkers-editor.width', 'Opacity')}>
              <Slider
                included
                min={0}
                max={1}
                step={0.01}
                value={marker.opts.opacity ?? 1}
                onChange={(v) => handleOptsSettingChange(marker.id, 'opacity', typeof v === 'number' ? v : v[0])}
                marks={{ 0: '0.01', 1: '1' }}
              />
            </Field>
          </div>
        </div>
      ))}
    </div>
  );
};
