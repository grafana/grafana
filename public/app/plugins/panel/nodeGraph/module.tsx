import { FieldConfigProperty, FieldNamePickerBaseNameMode, PanelPlugin } from '@grafana/data';

import { NodeGraphPanel } from './NodeGraphPanel';
import { ArcOptionsEditor } from './editor/ArcOptionsEditor';
import { NodeGraphSuggestionsSupplier } from './suggestions';
import { NodeGraphOptions } from './types';

export const plugin = new PanelPlugin<NodeGraphOptions>(NodeGraphPanel)
  .useFieldConfig({
    disableStandardOptions: Object.values(FieldConfigProperty).filter((v) => v !== FieldConfigProperty.Links),
  })
  .setPanelOptions((builder, context) => {
    builder.addSelect({
      name: 'Zoom mode',
      path: 'zoomMode',
      defaultValue: 'cooperative',
      settings: {
        options: [
          { value: 'cooperative', label: 'Cooperative', description: 'Lets you scroll the page normally' },
          { value: 'greedy', label: 'Greedy', description: 'Reacts to all zoom gestures' },
        ],
      },
    });
    builder.addNestedOptions({
      category: ['Nodes'],
      path: 'nodes',
      build: (builder) => {
        builder.addUnitPicker({
          name: 'Main stat unit',
          path: 'mainStatUnit',
        });
        builder.addUnitPicker({
          name: 'Secondary stat unit',
          path: 'secondaryStatUnit',
        });
        builder.addCustomEditor({
          name: 'Arc sections',
          path: 'arcs',
          id: 'arcs',
          editor: ArcOptionsEditor,
          settings: {
            baseNameMode: FieldNamePickerBaseNameMode.OnlyBaseNames,
          },
        });
        builder.addTextInput({
          category: ['Field names'],
          name: 'Details prefix',
          path: 'detailsPrefix',
        });
        builder.addTextInput({
          category: ['Field names'],
          name: 'Arcs prefix',
          path: 'arcsPrefix',
        });
        builder.addFieldNamePicker({
          category: ['Field names'],
          name: 'ID field',
          path: 'idField',
          settings: {
            baseNameMode: FieldNamePickerBaseNameMode.OnlyBaseNames,
          },
        });
        builder.addFieldNamePicker({
          category: ['Field names'],
          name: 'Title field',
          path: 'titleField',
          settings: {
            baseNameMode: FieldNamePickerBaseNameMode.OnlyBaseNames,
          },
        });
        builder.addFieldNamePicker({
          category: ['Field names'],
          name: 'Subtitle field',
          path: 'subtitleField',
          settings: {
            baseNameMode: FieldNamePickerBaseNameMode.OnlyBaseNames,
          },
        });
        builder.addFieldNamePicker({
          category: ['Field names'],
          name: 'Secondary stat field',
          path: 'secondaryStatField',
          settings: {
            baseNameMode: FieldNamePickerBaseNameMode.OnlyBaseNames,
          },
        });
        builder.addFieldNamePicker({
          category: ['Field names'],
          name: 'Color field',
          path: 'colorField',
          settings: {
            baseNameMode: FieldNamePickerBaseNameMode.OnlyBaseNames,
          },
        });
        builder.addFieldNamePicker({
          category: ['Field names'],
          name: 'Icon field',
          path: 'iconField',
          settings: {
            baseNameMode: FieldNamePickerBaseNameMode.OnlyBaseNames,
          },
        });
        builder.addFieldNamePicker({
          category: ['Field names'],
          name: 'Node radius field',
          path: 'nodeRadiusField',
          settings: {
            baseNameMode: FieldNamePickerBaseNameMode.OnlyBaseNames,
          },
        });
        builder.addFieldNamePicker({
          category: ['Field names'],
          name: 'Highlighted field',
          path: 'highlightedField',
          settings: {
            baseNameMode: FieldNamePickerBaseNameMode.OnlyBaseNames,
          },
        });
      },
    });
    builder.addNestedOptions({
      category: ['Edges'],
      path: 'edges',
      build: (builder) => {
        builder.addUnitPicker({
          name: 'Main stat unit',
          path: 'mainStatUnit',
        });
        builder.addUnitPicker({
          name: 'Secondary stat unit',
          path: 'secondaryStatUnit',
        });
        builder.addTextInput({
          category: ['Field names'],
          name: 'Details prefix',
          path: 'detailsPrefix',
        });
        builder.addFieldNamePicker({
          category: ['Field names'],
          name: 'ID field',
          path: 'idField',
          settings: {
            baseNameMode: FieldNamePickerBaseNameMode.OnlyBaseNames,
          },
        });
        builder.addFieldNamePicker({
          category: ['Field names'],
          name: 'Source field',
          path: 'sourceField',
          settings: {
            baseNameMode: FieldNamePickerBaseNameMode.OnlyBaseNames,
          },
        });
        builder.addFieldNamePicker({
          category: ['Field names'],
          name: 'Target field',
          path: 'targetField',
          settings: {
            baseNameMode: FieldNamePickerBaseNameMode.OnlyBaseNames,
          },
        });
        builder.addFieldNamePicker({
          category: ['Field names'],
          name: 'Main stat field',
          path: 'mainStatField',
          settings: {
            baseNameMode: FieldNamePickerBaseNameMode.OnlyBaseNames,
          },
        });
        builder.addFieldNamePicker({
          category: ['Field names'],
          name: 'Secondary stat field',
          path: 'secondaryStatField',
          settings: {
            baseNameMode: FieldNamePickerBaseNameMode.OnlyBaseNames,
          },
        });
        builder.addFieldNamePicker({
          category: ['Field names'],
          name: 'Thickness field',
          path: 'thicknessField',
          settings: {
            baseNameMode: FieldNamePickerBaseNameMode.OnlyBaseNames,
          },
        });
        builder.addFieldNamePicker({
          category: ['Field names'],
          name: 'Color field',
          path: 'colorField',
          settings: {
            baseNameMode: FieldNamePickerBaseNameMode.OnlyBaseNames,
          },
        });
        builder.addFieldNamePicker({
          category: ['Field names'],
          name: 'Stroke field',
          path: 'strokeDasharrayField',
          description:
            'Sets the pattern of dashes and gaps used to render the edge. If unset, a solid line is used as edge. For more information and examples, refer to the stroke-dasharray MDN documentation.',
          settings: {
            baseNameMode: FieldNamePickerBaseNameMode.OnlyBaseNames,
          },
        });
      },
    });
  })
  .setSuggestionsSupplier(new NodeGraphSuggestionsSupplier());
