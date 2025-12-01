import { css } from '@emotion/css';

import { StandardEditorProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  Button,
  Field,
  InlineField,
  Input,
  Label,
  Combobox,
  ComboboxOption,
  useTheme2,
  Slider,
  ColorPicker,
  Divider,

  
} from '@grafana/ui';

import { hoverColor } from '../../../../../packages/grafana-ui/src/themes/mixins';

import { BarMarkerOpts, MarkerGroup, Markers } from './markerTypes';
import { Options } from './panelcfg.gen';
import { Panel } from '@grafana/schema';
import { PanelOptionsEditorBuilder, StandardEditorContext } from '@grafana/data';
import { buttonItem } from 'app/features/canvas/elements/button';
import { Marker } from '../nodeGraph/Marker';
import { Direction } from '../../datasource/cloudwatch/types';
import { Title } from '../../../features/alerting/unified/group-details/Title';
import { Default } from '../../../../../packages/grafana-ui/src/components/Forms/RadioButtonList/RadioButtonList.story';
import { defaultValue } from 'app/features/logs/components/panel/__mocks__/LogListContext';
import { AddButton } from '../../datasource/influxdb/components/editor/query/influxql/visual/AddButton';
import { context } from '@opentelemetry/api';
import { NIL } from 'uuid';

export const barMarkersEditor2 = (builder: PanelOptionsEditorBuilder<Markers>, ctx: StandardEditorContext<Markers> ) => {
    let markers : MarkerGroup[] = ctx.options?.markerGroups || [];

      const shapeOptions: Array<ComboboxOption<string>> = [
        { label: 'Circle', value: 'circle' },
        { label: 'Cross', value: 'cross' },
        { label: 'Line', value: 'line' },
        { label: 'Star', value: 'star' },
      ];

      var markerSlct: Array<ComboboxOption<string>> = []


    markers.forEach((marker: MarkerGroup, i) => {
      markerSlct.push({label: marker.opts.label , value: marker.id.toString() })
    })

    builder.addSelect({
      path: '.select',
      name: 'Editing Marker:',
      settings: {options: markerSlct, isClearable: true},
    })

    builder.addCustomEditor({
      id: 'marker-divider',
      name: '',
      path: '__', //not used
      editor: () => {
        return (<Divider />);
      }
    });

    markers.forEach((_ , i: number) => {

      builder.addTextInput({
        path: `.markerGroups[${i}].opts.label`,
        name: t('barchart.editor.markers.label', 'Label'),
        showIf: (opts) => opts.select === opts.markerGroups[i].id.toString(),
        settings: {hover: "targetField"}
      });
      builder.addFieldNamePicker({
        path: `.markerGroups[${i}].targetField`,
        name: t('barchart.editor.markers.label', 'Target Field'),
        showIf: (opts) => opts.select === opts.markerGroups[i].id.toString(),
        description: t('barchart.editor.targetfield.descr', 'Picks the field on which the markers will appear')
      });
      builder.addFieldNamePicker({
        path: `.markerGroups[${i}].dataField`,
        name: t('barchart.editor.markers.label', 'Data Field'),
        showIf: (opts) => opts.select === opts.markerGroups[i].id.toString(),
        description: t('barchart.editor.datafield.descr', "Marker positions use the data field's y-values, the data field is removed while in use.")
      }); 
        
      builder.addColorPicker({
        path: `.markerGroups[${i}].opts.color`,
        name: t('barchart.editor.markers.color', 'Color'),
        showIf: (opts) => opts.select === opts.markerGroups[i].id.toString(),
      });
      builder.addRadio({
        path: `.markerGroups[${i}].opts.shape`,
        name: t('barchart.editor.markers.shape', 'Shape'),
        showIf: (opts) => opts.select === opts.markerGroups[i].id.toString(),
        settings: {
          options: shapeOptions,
          fullwidth: true
        },
      })
      builder.addSliderInput({
        path: `.markerGroups[${i}].opts.size`,
        name: t('barchart.editor.markers.size', 'Size'),
        showIf: (opts) => opts.select === opts.markerGroups[i].id.toString(),
        settings: {
          min: 0,
          max: 100,
          step: 1,
          defaultValue: 0.1,
        }
      });
      builder.addSliderInput({
        path: `.markerGroups[${i}].opts.opacity`,
        name: t('barchart.editor.markers.opacity', 'Opacity'),
        showIf: (opts) => opts.select === opts.markerGroups[i].id.toString(),
        settings: {
          min: 0,
          max: 1,
          step: 0.01,
          defaultValue: 0.5,
        }
      });
      
      builder.addBooleanSwitch({
        path: `.markerGroups[${i}].opts.fill`,
        name: t('barchart.editor.markers.fill', 'Fill'),
        showIf: (opts) => opts.select === opts.markerGroups[i].id.toString()
          && opts.markerGroups[i].opts.shape != 'line' 
          && opts.markerGroups[i].opts.shape != 'cross',
        settings: {
          defaultValue: true,
        }
      })

      builder.addSliderInput({
        path: `.markerGroups[${i}].opts.strokeWidth`,
        name: t('barchart.editor.markers.strokeWidth', 'Stroke Width'),
        showIf: (opts) => opts.select === opts.markerGroups[i].id.toString() ,
        settings: {
          defaultValue: 3,
          min : 1,
          max: 10,
        }
      })
    });
  
} 

export const addMarkerEditor = ({ context, onChange, value }: StandardEditorProps<Markers>) => {
  const theme = useTheme2();

  let markers = value.markerGroups || [];

  const handleAddMarker = () => {
    let newId = Math.max(...markers.map((m) => m.id), 0) + 1;

    const newMarker: MarkerGroup = {
      id: newId,
      targetField: '',
      dataField: '',
      opts: {
        label: `Marker ${markers.length + 1}`,
        color: 'rgb(184, 119, 217)',
        shape: 'cross',
        size: 30,
        opacity: 1,
        fill: false,
        strokeWidth: 3,
      },
      
    };
    markers = [...markers, newMarker];
    value.markerGroups = markers
    value.select = newId.toString()
    onChange(value);
  };

  return(
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
        {t('barchart.barmarkers-editor.add-marker', 'Add marker +')}
      </Button>
      </div>
  )
}

export const removeMarkerEditor = ({onChange, value, context}: StandardEditorProps<Markers>) => {
  const theme = useTheme2();
  let markerGroups = value?.markerGroups || [];
  const handleRemoveMarker = (id: number) => {
          markerGroups = markerGroups.filter((marker: MarkerGroup) => marker.id !== id);
          value.markerGroups = markerGroups
          value.select = undefined
          onChange(value)};
  return(
    <div>
      <Button
        fullWidth={true}
        onClick={() => handleRemoveMarker(Number(value.select))}
        className={css({
          backgroundColor: theme.colors.secondary.main,
          color: theme.colors.text.primary,
          '&:hover': {
            backgroundColor: hoverColor(theme.colors.action.hover, theme),
          },
        })}
      >
        {t('barchart.barmarkers-editor.add-marker', 'Remove marker')}
      </Button>
      </div>
  )
}