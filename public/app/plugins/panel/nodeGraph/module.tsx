import { Field, PanelPlugin } from '@grafana/data';

import { NodeGraphPanel } from './NodeGraphPanel';
import { ArcOptionsEditor } from './editor/ArcOptionsEditor';
import { RawFieldSelector } from './editor/RawFieldNameSelect';
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
            context.options?.nodeNameOverrides?.arc !== undefined
              ? (field: Field) => field.name.includes(context.options?.nodeNameOverrides?.arc || '')
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
    category: ['Node names'],
    path: 'nodeNameOverrides',
    build: (builder) => {
      builder.addCustomEditor({
        name: 'Id',
        path: 'id',
        id: 'id',
        editor: RawFieldSelector,
      });
      builder.addCustomEditor({
        name: 'Title',
        path: 'title',
        id: 'title',
        editor: RawFieldSelector,
      });
      builder.addCustomEditor({
        name: 'Sub title',
        path: 'subTitle',
        id: 'subTitle',
        editor: RawFieldSelector,
      });
      builder.addCustomEditor({
        name: 'Main stat',
        path: 'mainStat',
        id: 'mainStat',
        editor: RawFieldSelector,
      });
      builder.addCustomEditor({
        name: 'Secondary stat',
        path: 'secondaryStat',
        id: 'secondaryStat',
        editor: RawFieldSelector,
      });
      builder.addCustomEditor({
        name: 'Arc prefix',
        path: 'arc',
        id: 'arc',
        editor: RawFieldSelector,
      });
      builder.addCustomEditor({
        name: 'Details prefix',
        path: 'details',
        id: 'details',
        editor: RawFieldSelector,
      });
      builder.addCustomEditor({
        name: 'Color',
        path: 'color',
        id: 'color',
        editor: RawFieldSelector,
      });
      builder.addCustomEditor({
        name: 'Icon',
        path: 'icon',
        id: 'icon',
        editor: RawFieldSelector,
      });
      builder.addCustomEditor({
        name: 'Node radius',
        path: 'nodeRadius',
        id: 'nodeRadius',
        editor: RawFieldSelector,
      });
    },
  });
  builder.addNestedOptions({
    category: ['Edge names'],
    path: 'edgeNameOverrides',
    build: (builder) => {
      builder.addCustomEditor({
        name: 'Id',
        path: 'id',
        id: 'id',
        editor: RawFieldSelector,
      });
      builder.addCustomEditor({
        name: 'Main stat',
        path: 'mainStat',
        id: 'mainStat',
        editor: RawFieldSelector,
      });
      builder.addCustomEditor({
        name: 'Secondary stat',
        path: 'secondaryStat',
        id: 'secondaryStat',
        editor: RawFieldSelector,
      });
      builder.addCustomEditor({
        name: 'Details prefix',
        path: 'details',
        id: 'details',
        editor: RawFieldSelector,
      });
      builder.addCustomEditor({
        name: 'Color',
        path: 'color',
        id: 'color',
        editor: RawFieldSelector,
      });
      builder.addCustomEditor({
        name: 'Target',
        path: 'target',
        id: 'target',
        editor: RawFieldSelector,
      });
      builder.addCustomEditor({
        name: 'Source',
        path: 'source',
        id: 'source',
        editor: RawFieldSelector,
      });
    },
  });
});
