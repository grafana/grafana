import { css } from '@emotion/css';
import { DropResult } from '@hello-pangea/dnd';

import { StandardEditorProps, PanelOptionsEditorBuilder, StandardEditorContext } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, ComboboxOption, useTheme2 } from '@grafana/ui';
import { LayerDragDropList } from 'app/core/components/Layers/LayerDragDropList';

import { hoverColor } from '../../../../../packages/grafana-ui/src/themes/mixins';

import { MarkerGroup, Markers } from './markerTypes';

export const barMarkersEditor = (builder: PanelOptionsEditorBuilder<Markers>, ctx: StandardEditorContext<Markers>) => {
  let markers: MarkerGroup[] = ctx.options?.markerGroups || [];

  const shapeOptions: Array<ComboboxOption<string>> = [
    { label: 'Circle', value: 'circle' },
    { label: 'Cross', value: 'cross' },
    { label: 'Line', value: 'line' },
    { label: 'Star', value: 'star' },
  ];

  let markerSlct: Array<ComboboxOption<string>> = [];

  markers.forEach((marker: MarkerGroup, i) => {
    markerSlct.push({ label: marker.opts.label, value: marker.id.toString() });
  });

  builder.addCustomEditor({
    id: 'barchart.markers.DragDropEditor',
    path: '',
    name: t('barchart.editor.markers.DragDropEditing', 'Markers'),
    editor: MarkerDragDropEditor,
    showIf: (opts) => opts.markerGroups.length > 0,
  });

  markers.forEach((_, i: number) => {
    
    builder.addFieldNamePicker({
      path: `.markerGroups[${i}].targetField`,
      name: t('barchart.editor.markers.label', 'Target field'),
      showIf: (opts) => opts.select === opts.markerGroups[i].id.toString(),
      description: t('barchart.editor.targetfield.descr', 'Picks the field on which the markers will appear'),
    });
    builder.addFieldNamePicker({
      path: `.markerGroups[${i}].dataField`,
      name: t('barchart.editor.markers.label', 'Data field'),
      showIf: (opts) => opts.select === opts.markerGroups[i].id.toString(),
      description: t(
        'barchart.editor.datafield.descr',
        "Marker positions use the data field's y-values, the data field is removed while in use."
      ),
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
        fullwidth: true,
      },
    });
    builder.addSliderInput({
      path: `.markerGroups[${i}].opts.size`,
      name: t('barchart.editor.markers.size', 'Size'),
      showIf: (opts) => opts.select === opts.markerGroups[i].id.toString(),
      settings: {
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 0.1,
      },
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
      },
    });

    builder.addBooleanSwitch({
      path: `.markerGroups[${i}].opts.fill`,
      name: t('barchart.editor.markers.fill', 'Fill'),
      showIf: (opts) =>
        opts.select === opts.markerGroups[i].id.toString() &&
        opts.markerGroups[i].opts.shape !== 'line' &&
        opts.markerGroups[i].opts.shape !== 'cross',
      settings: {
        defaultValue: true,
      },
    });

    builder.addSliderInput({
      path: `.markerGroups[${i}].opts.strokeWidth`,
      name: t('barchart.editor.markers.strokeWidth', 'Stroke width'),
      showIf: (opts) => opts.select === opts.markerGroups[i].id.toString(),
      settings: {
        defaultValue: 3,
        min: 1,
        max: 10,
      },
    });
  });
};

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
        color: 'purple',
        shape: 'cross',
        size: 30,
        opacity: 1,
        fill: false,
        strokeWidth: 3,
      },
    };
    markers = [...markers, newMarker];
    value.markerGroups = markers;
    value.select = newId.toString();
    onChange(value);
  };

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
        {t('barchart.barmarkers-editor.add-marker', 'Add marker +')}
      </Button>
    </div>
  );
};

export const MarkerDragDropEditor = ({ value, context, onChange }: StandardEditorProps<Markers>) => {
  const markerGroups = value?.markerGroups || [];

  // LayerDragDropList reverses the order of the passed layers. Reverse back to keep natural order.
  const layers = markerGroups
    .slice()
    .reverse()
    .map((m) => ({ ...(m as any), getName: () => m.opts.label.toString() }));

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const srcIdx = result.source.index;
    const dstIdx = result.destination.index;

    if (srcIdx === dstIdx) {
      return;
    }

    const newGroups = [...markerGroups];
    const [moved] = newGroups.splice(srcIdx, 1);
    newGroups.splice(dstIdx, 0, moved);

    value.markerGroups = newGroups;
    onChange(value);
  };

  const handleSelect = (element: any) => {
    if (value.select === element.id.toString()) {
      value.select = undefined;
      onChange(value);
      return;
    }
    value.select = element.id.toString();
    onChange(value);
  };

  const handleDelete = (element: any) => {
    const newGroups = markerGroups.filter((m) => m.id !== element.id);
    value.markerGroups = newGroups;
    if (value.select === element.id.toString()) {
      value.select = undefined;
    }
    onChange(value);
  };

  const handleNameChange = (element: any, newName: string) => {
    const newGroups = markerGroups.map((m) =>
      m.id === element.id ? { ...m, opts: { ...(m.opts || {}), label: newName } } : m
    );
    value.markerGroups = newGroups;
    onChange(value);
  };

  const verifyName = (nameToCheck: string) => {
    return !markerGroups.some((m) => m.opts?.label === nameToCheck);
  };

  const getLayerInfo = (m: MarkerGroup) => {
    return m.dataField || '-'
  };

  const selectionByName = value.select
    ? markerGroups.filter((m) => m.id.toString() === value.select).map((m) => m.opts?.label || '')
    : [];

  return (
    <LayerDragDropList
      layers={layers}
      getLayerInfo={getLayerInfo}
      onDragEnd={handleDragEnd}
      onSelect={handleSelect}
      onDelete={handleDelete}
      showActions={() => true}
      selection={selectionByName}
      onNameChange={handleNameChange}
      verifyLayerNameUniqueness={verifyName}
    />
  );
};
