import { StandardEditorProps, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Field, Input, Select } from '@grafana/ui';
import { useState } from 'react';

// Define the structure for marker settings
interface MarkerSettings {
  id: number;
  xAxis: string;
  yAxis: number;
  color: string;
  shape: string;
}

export const BarMarkersEditor = (props: StandardEditorProps<MarkerSettings[]>) => {
  // State to manage the list of markers
  const [markers, setMarkers] = useState<MarkerSettings[]>(props.value || []);

  // Add a new marker to the list
  const handleAddMarker = () => {
    const newMarker: MarkerSettings = {
      id: markers.length + 1,
      xAxis: '',
      yAxis: 0,
      color: '',
      shape: '',
    };
    const updatedMarkers = [...markers, newMarker];
    setMarkers(updatedMarkers);
    props.onChange(updatedMarkers); // Notify parent component of the change
  };

  // Update a specific field of a marker
  const handleSettingChange = (id: number, field: keyof MarkerSettings, newValue: string) => {
    const updatedMarkers = markers.map((marker: MarkerSettings) =>
      marker.id === id ? { ...marker, [field]: newValue } : marker
    );
    setMarkers(updatedMarkers);
    props.onChange(updatedMarkers); // Notify parent component of the change
  };

  // Remove a marker from the list
  const handleRemoveMarker = (id: number) => {
    const updatedMarkers = markers.filter((marker: MarkerSettings) => marker.id !== id);
    setMarkers(updatedMarkers);
    props.onChange(updatedMarkers); // Notify parent component of the change
  };

  // Options for the color dropdown
  const colorOptions: Array<SelectableValue<string>> = [
    { label: 'Red', value: 'red' },
    { label: 'Blue', value: 'blue' },
    { label: 'Green', value: 'green' },
  ];

  // Options for the shape dropdown
  const shapeOptions: Array<SelectableValue<string>> = [
    { label: 'Line', value: 'line' },

  ];

  return (
    <div>
      {/* Button to add a new marker */}
      <Button onClick={handleAddMarker}>
        {t('barchart.barmarkers-editor.add-marker', 'Add Marker')}
      </Button>
      {/* Render each marker as a grouped UI element */}
      {markers.map((marker: MarkerSettings) => (
        <div
          key={marker.id}
          style={{
            marginTop: '10px',
            border: '1px solid #555555ff',
            padding: '10px',
            borderRadius: '4px',
            position: 'relative',
          }}
        >
          {/* Marker title */}
          <h4>
            {t('barchart.barmarkers-editor.marker-title', `Marker ${marker.id}`)}
          </h4>
          {/* Button to remove the marker */}
          <Button
            variant="destructive"
            size="sm"
            style={{ position: 'absolute', top: '10px', right: '10px' }}
            onClick={() => handleRemoveMarker(marker.id)}
          >
            {t('barchart.barmarkers-editor.remove-marker', 'X')}
          </Button>
          {/* Input field for X-Axis */}
          <Field label={t('barchart.barmarkers-editor.x-axis', 'X-Axis')}>
            <Input
              value={marker.xAxis}
              onChange={(e) =>
                handleSettingChange(marker.id, 'xAxis', (e.target as HTMLInputElement).value)
              }
              placeholder={t('barchart.barmarkers-editor.x-axis-placeholder', 'Select X-Axis')}
            />
          </Field>
          {/* Input field for Y-Axis */}
          <Field label={t('barchart.barmarkers-editor.y-axis', 'Y-Axis')}>
            <Input
              type="number"
              value={marker.yAxis}
              onChange={(e) =>
                handleSettingChange(marker.id, 'yAxis', (e.target as HTMLInputElement).value)
              }
              placeholder={t('barchart.barmarkers-editor.y-axis-placeholder', 'Enter Y-Axis value')}
            />
          </Field>
          {/* Dropdown for Color */}
          <Field label={t('barchart.barmarkers-editor.color', 'Color')}>
            <Select
              options={colorOptions}
              value={marker.color}
              onChange={(v) =>
                handleSettingChange(marker.id, 'color', v.value!)
              }
              placeholder={t('barchart.barmarkers-editor.color-placeholder', 'Select Color')}
            />
          </Field>
          {/* Dropdown for Shape */}
          <Field label={t('barchart.barmarkers-editor.shape', 'Shape')}>
            <Select
              options={shapeOptions}
              value={marker.shape}
              onChange={(v) =>
                handleSettingChange(marker.id, 'shape', v.value!)
              }
              placeholder={t('barchart.barmarkers-editor.shape-placeholder', 'Select Shape')}
            />
          </Field>
        </div>
      ))}
    </div>
  );
};
