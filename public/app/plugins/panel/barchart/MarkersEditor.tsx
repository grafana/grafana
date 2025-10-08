import React from 'react';
import { StandardEditorProps } from '@grafana/data';
import { Button, Field, Select, ColorPicker, NumberInput, Switch, FieldNamePicker } from '@grafana/ui';
import { BarMarker } from './panelcfg.gen';

export interface MarkersEditorProps extends StandardEditorProps<BarMarker[]> {}

const MARKER_SHAPES = [
  { label: 'Circle', value: 'circle' },
  { label: 'Square', value: 'square' },
  { label: 'Diamond', value: 'diamond' },
  { label: 'Triangle', value: 'triangle' },
];

const DEFAULT_MARKER: BarMarker = {
  field: '',
  shape: 'circle',
  color: '#e74c3c',
  size: 6,
  showValue: false,
};

export const MarkersEditor: React.FC<MarkersEditorProps> = ({ value = [], onChange, context }) => {
  const markers = value || [];

  const onMarkerChange = (index: number, marker: Partial<BarMarker>) => {
    const newMarkers = [...markers];
    newMarkers[index] = { ...newMarkers[index], ...marker };
    onChange(newMarkers);
  };

  const onMarkerAdd = () => {
    const newMarkers = [...markers, { ...DEFAULT_MARKER }];
    onChange(newMarkers);
  };

  const onMarkerRemove = (index: number) => {
    const newMarkers = markers.filter((_, i) => i !== index);
    onChange(newMarkers);
  };

  const validateMarker = (marker: BarMarker) => {
    const issues = [];
    if (!marker.field) {
      issues.push('Field is required');
    }
    if (marker.size < 2 || marker.size > 20) {
      issues.push('Size must be between 2 and 20');
    }
    return issues;
  };

  return (
    <div>
      {markers.map((marker, index) => (
        <div key={index} style={{ marginBottom: '16px', padding: '12px', border: '1px solid #444', borderRadius: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h6>Marker {index + 1}</h6>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onMarkerRemove(index)}
              aria-label="Remove marker"
            >
              Remove
            </Button>
          </div>
          
          <Field label="Field">
            <FieldNamePicker
              context={context}
              value={marker.field}
              onChange={(field) => onMarkerChange(index, { field })}
            />
          </Field>
          
          <Field label="Shape">
            <Select
              value={marker.shape}
              options={MARKER_SHAPES}
              onChange={(option) => onMarkerChange(index, { shape: option.value as BarMarker['shape'] })}
            />
          </Field>
          
          <Field label="Color">
            <ColorPicker
              color={marker.color || '#e74c3c'}
              onChange={(color) => onMarkerChange(index, { color })}
            />
          </Field>
          
          <Field label="Size">
            <NumberInput
              value={marker.size}
              min={2}
              max={20}
              onChange={(size) => onMarkerChange(index, { size: size || 6 })}
            />
          </Field>
          
          <Field label="Show value">
            <Switch
              value={marker.showValue}
              onChange={(showValue) => onMarkerChange(index, { showValue })}
            />
          </Field>
        </div>
      ))}
      
      <Button onClick={onMarkerAdd} variant="secondary">
        Add Marker
      </Button>
    </div>
  );
};