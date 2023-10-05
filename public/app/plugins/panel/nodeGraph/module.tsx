import { Field, NodeGraphDataFrameFieldNames, PanelPlugin } from '@grafana/data';

import { NodeGraphPanel } from './NodeGraphPanel';
import { ArcOptionsEditor } from './editor/ArcOptionsEditor';
import { NodeGraphOptions } from './types';

export const plugin = new PanelPlugin<NodeGraphOptions>(NodeGraphPanel).setPanelOptions((builder, context) => {
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
          filter:
            context.options?.fieldNameOverrides?.arc !== undefined
              ? (field: Field) => field.name.includes(context.options?.fieldNameOverrides?.arc || '')
              : undefined,
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
    },
  });
  builder.addNestedOptions({
    category: ['Field names'],
    path: 'fieldNameOverrides',
    build: (builder) => {
      builder.addTextInput({
        name: 'Id',
        path: 'id',
        settings: { placeholder: NodeGraphDataFrameFieldNames.id },
      });
      builder.addTextInput({
        name: 'Title',
        path: 'title',
        settings: { placeholder: NodeGraphDataFrameFieldNames.title },
      });
      builder.addTextInput({
        name: 'Sub title',
        path: 'subTitle',
        settings: { placeholder: NodeGraphDataFrameFieldNames.subTitle },
      });
      builder.addTextInput({
        name: 'Main stat',
        path: 'mainStat',
        settings: { placeholder: NodeGraphDataFrameFieldNames.mainStat },
      });
      builder.addTextInput({
        name: 'Secondary stat',
        path: 'secondaryStat',
        settings: { placeholder: NodeGraphDataFrameFieldNames.secondaryStat },
      });
      builder.addTextInput({
        name: 'Arc prefix',
        path: 'arc',
        settings: { placeholder: NodeGraphDataFrameFieldNames.arc },
      });
      builder.addTextInput({
        name: 'Details prefix',
        path: 'details',
        settings: { placeholder: NodeGraphDataFrameFieldNames.detail },
      });
      builder.addTextInput({
        name: 'Color',
        path: 'color',
        settings: { placeholder: NodeGraphDataFrameFieldNames.color },
      });
      builder.addTextInput({
        name: 'Icon',
        path: 'icon',
        settings: { placeholder: NodeGraphDataFrameFieldNames.icon },
      });
      builder.addTextInput({
        name: 'Node radius',
        path: 'nodeRadius',
        settings: { placeholder: NodeGraphDataFrameFieldNames.nodeRadius },
      });
      builder.addTextInput({
        name: 'Target',
        path: 'target',
        settings: { placeholder: NodeGraphDataFrameFieldNames.target },
      });
      builder.addTextInput({
        name: 'Source',
        path: 'source',
        settings: { placeholder: NodeGraphDataFrameFieldNames.source },
      });
    },
  });
});
