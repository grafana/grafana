import { css } from '@emotion/css';
import { GrafanaTheme2, StandardEditorProps} from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Field, InlineField, Input, Label, Combobox,  useStyles2, ComboboxOption, useTheme2, Slider } from '@grafana/ui';
import { useState } from 'react';
import { ColorPicker } from '../../../../../packages/grafana-ui/src/components/ColorPicker/ColorPicker';
import { BarMarkerOpts, Marker} from './markerTypes';

import { hoverColor } from '../../../../../packages/grafana-ui/src/themes/mixins';


export const BarMarkersEditor = (props: StandardEditorProps<Marker[]>) => {
  // State to manage the list of markers

const theme = useTheme2();

var [markers, setMarkers] = useState<Marker[]>(props.value || []);

    // Remove a marker from the list
  const handleRemoveMarker = (id: number) => {
    const updatedMarkers = markers.filter((marker: Marker) => marker.id !== id);
    setMarkers(updatedMarkers);
    props.onChange(updatedMarkers); // Notify parent component of the change
  };

  const handleAddMarker = () => {

    let newId = 1;
    let cond = true;
    while(cond){
      cond = false
      for(const m of markers){
        if(m.id === newId){
          newId = m.id + 1;
          cond = true;
          break;
        }
      }
    }

    const newMarker: Marker = {
      id : newId,
      targetField: "",
      dataField: "",
      opts: {
        label: `Marker ${markers.length + 1}`,
        color: 'rgb(184, 119, 217)',
        shape: 'line',
        width: 1,
        isRotated: false,
        opacity: 0.7

      },
    };
    const updatedMarkers = [...markers, newMarker];
    markers = updatedMarkers;
    setMarkers(markers);
    props.onChange(markers); // Notify parent component of the change
  };

  
    const fields =  props.context?.data[0]?.fields ?? [];
    const xAxis = props.context?.options?.xField;
    var xFieldIdx = 0;
    if(xAxis){
      xFieldIdx = fields.findIndex(f => f.name === xAxis);
    }
    var yFieldOptions: Array<ComboboxOption<string | number>> = [];
    for (let i = 0; i < fields.length; i++) {
      if (i === xFieldIdx){continue;}
      if(fields)
      yFieldOptions.push({ label: fields[i].name ?? `Field ${i}`, value: fields[i].name ?? i });
    }

  
  // Update a specific field of a marker
  const handleOptsSettingChange = (id: number, field: keyof BarMarkerOpts, newValue: string | number | undefined) => {
    const updatedMarkers = markers.map((marker: Marker) =>
      marker.id === id ? { ...marker, opts: { ...marker.opts, [field]: newValue } } : marker
    );
    setMarkers(updatedMarkers);
    props.onChange(updatedMarkers); // Notify parent component of the change
  };



  // Update a specific field of a marker
  const handleSettingChange = (id: number, field: keyof Marker, newValue:  string | number | undefined) => {
  
 
    const updatedMarkers = markers.map((marker: Marker) =>
      marker.id === id ? { ...marker, [field]: newValue } : marker
    );
    setMarkers(updatedMarkers);
    props.onChange(updatedMarkers); // Notify parent component of the change
  
  };


  // Options for the shape dropdown
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
            {/* Editable Marker title */}
            <div style={{ minWidth: '120px', padding: '5px' }}>
              <InlineField
               label={t('barchart.barmarkers-editor.marker-title', 'Title')}>
                
                 <div style={{ maxWidth: '160px'}}>
                <Input
            value={marker.opts.label ?? `Marker ${marker.id}`}
            onChange={(e) =>
              handleOptsSettingChange(marker.id, 'label', (e.target as HTMLInputElement).value)
            }
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
              
            <div style={{ minWidth: '120px', padding: '5px'}}>
              
              <Field label={t('barchart.barmarkers-editor.y-axis', 'Target Field')}>
              <Combobox
                
                options= {yFieldOptions}
                value={marker.targetField ?? ''}
                onChange={(v) =>
                handleSettingChange(marker.id, 'targetField', v.value?? '')
                }
                placeholder={t('barchart.barmarkers-editor.y-axis-placeholder', 'Select Y-Axis value')}
              />
              </Field>
            </div>
            <div style={{ minWidth: '120px', padding: '5px' }}>
              <Field label={t('barchart.barmarkers-editor.y-axis', 'Data Input')}>
              <Combobox
                options= {yFieldOptions}
                value={marker.dataField ?? ''}
                onChange={(v) =>
                handleSettingChange(marker.id, 'dataField', v.value?? '')
                }
                placeholder={t('barchart.barmarkers-editor.y-axis-placeholder', 'Select Y-Axis value')}
              />
              </Field>
            </div>
              {/* Color Picker for Marker */}
              <div style={{ minWidth: '120px', padding: '5px', paddingBottom: '10px' }}>
                <Label>{t('barchart.barmarkers-editor.color', 'Color')}</Label>
                <ColorPicker
                color={marker.opts.color || 'rgb(184, 119, 217)'}
                onChange={(color: string) => handleOptsSettingChange(marker.id, 'color', color)}
                />
              </div>
            {/* Dropdown for Shape */}
            <div style={{ minWidth: '120px', padding: '5px' }}>
              <Field label={t('barchart.barmarkers-editor.shape', 'Shape')}>
                <Combobox
            options={shapeOptions}
            value={marker.opts.shape ?? 'line'}
            onChange={(v) =>
              handleOptsSettingChange(marker.id, 'shape', v.value!)
            }
                />
              </Field>
            </div>
            <div >
              <Field label={t('barchart.barmarkers-editor.width', 'Size')}>
                <Slider
                  included
                  min={0.01}
                  max={2}
                  step={0.01}
                  value={marker.opts.width ?? 1}
                  onChange={(v) => handleOptsSettingChange(marker.id, 'width', typeof v === 'number' ? v : v[0])}
                  
                  marks= {{ 0.01: '0.01', 2: '2' }}
                />
              </Field>
            </div>
            <div >
              <Field label={t('barchart.barmarkers-editor.width', 'Opacity')}>
                <Slider
                  included
                  min={0}
                  max={1}
                  step={0.01}
                  value={marker.opts.opacity ?? 1}
                  onChange={(v) => handleOptsSettingChange(marker.id, 'opacity', typeof v === 'number' ? v : v[0])}
                  marks= {{ 0: '0.01', 1: '1' }}
                />
              </Field>
            </div>
          </div>
        ))}

    </div>
    
  );
};
