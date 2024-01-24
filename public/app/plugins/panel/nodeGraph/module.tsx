import { Field, NodeGraphDataFrameFieldNames, PanelPlugin } from '@grafana/data';

import { NodeGraphPanel } from './NodeGraphPanel';
import { ArcOptionsEditor } from './editor/ArcOptionsEditor';
import { FrameSelector } from './editor/FrameSelect';
import { RawFieldSelector, FrameType } from './editor/RawFieldNameSelect';
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
      builder.addCustomEditor({
        name: 'Frame',
        path: 'frameName',
        id: 'frameName',
        editor: FrameSelector,
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
      builder.addCustomEditor({
        name: 'Frame',
        path: 'frameName',
        id: 'frameName',
        editor: FrameSelector,
      });
    },
  });

  builder.addNestedOptions({
    category: ['Node field name overrides'],
    path: 'nodeNameOverrides',
    build: (builder) => {
      builder.addCustomEditor({
        name: 'Id',
        path: 'id',
        id: 'id',
        editor: RawFieldSelector,
        settings: {
          placeholder: NodeGraphDataFrameFieldNames.id,
          frameType: FrameType.nodes,
          nodesFrameName: context.options?.nodes?.frameName,
        },
      });
      builder.addCustomEditor({
        name: 'Title',
        path: 'title',
        id: 'title',
        editor: RawFieldSelector,
        settings: {
          placeholder: NodeGraphDataFrameFieldNames.title,
          frameType: FrameType.nodes,
          nodesFrameName: context.options?.nodes?.frameName,
        },
      });
      builder.addCustomEditor({
        name: 'Sub title',
        path: 'subTitle',
        id: 'subTitle',
        editor: RawFieldSelector,
        settings: {
          placeholder: NodeGraphDataFrameFieldNames.subTitle,
          frameType: FrameType.nodes,
          nodesFrameName: context.options?.nodes?.frameName,
        },
      });
      builder.addCustomEditor({
        name: 'Main stat',
        path: 'mainStat',
        id: 'mainStat',
        editor: RawFieldSelector,
        settings: {
          placeholder: NodeGraphDataFrameFieldNames.mainStat,
          frameType: FrameType.nodes,
          nodesFrameName: context.options?.nodes?.frameName,
        },
      });
      builder.addCustomEditor({
        name: 'Secondary stat',
        path: 'secondaryStat',
        id: 'secondaryStat',
        editor: RawFieldSelector,
        settings: {
          placeholder: NodeGraphDataFrameFieldNames.secondaryStat,
          frameType: FrameType.nodes,
          nodesFrameName: context.options?.nodes?.frameName,
        },
      });
      builder.addTextInput({
        name: 'Arc prefix',
        path: 'arc',
        settings: { placeholder: NodeGraphDataFrameFieldNames.arc, nodesFrameName: context.options?.nodes?.frameName },
      });
      builder.addTextInput({
        name: 'Details prefix',
        path: 'details',
        settings: {
          placeholder: NodeGraphDataFrameFieldNames.detail,
          frameType: FrameType.nodes,
          nodesFrameName: context.options?.nodes?.frameName,
        },
      });
      builder.addCustomEditor({
        name: 'Color',
        path: 'color',
        id: 'color',
        editor: RawFieldSelector,
        settings: {
          placeholder: NodeGraphDataFrameFieldNames.color,
          frameType: FrameType.nodes,
          nodesFrameName: context.options?.nodes?.frameName,
        },
      });
      builder.addCustomEditor({
        name: 'Icon',
        path: 'icon',
        id: 'icon',
        editor: RawFieldSelector,
        settings: { placeholder: NodeGraphDataFrameFieldNames.icon, nodesFrameName: context.options?.nodes?.frameName },
      });
      builder.addCustomEditor({
        name: 'Node radius',
        path: 'nodeRadius',
        id: 'nodeRadius',
        editor: RawFieldSelector,
        settings: {
          placeholder: NodeGraphDataFrameFieldNames.nodeRadius,
          frameType: FrameType.nodes,
          nodesFrameName: context.options?.nodes?.frameName,
        },
      });
      builder.addCustomEditor({
        name: 'Highlighted',
        path: 'highlighted',
        id: 'highlighted',
        editor: RawFieldSelector,
        settings: {
          placeholder: NodeGraphDataFrameFieldNames.highlighted,
          frameType: FrameType.nodes,
          nodesFrameName: context.options?.nodes?.frameName,
        },
      });
    },
  });

  builder.addNestedOptions({
    category: ['Edge field names overrides'],
    path: 'edgeNameOverrides',
    build: (builder) => {
      builder.addCustomEditor({
        name: 'Id',
        path: 'id',
        id: 'id',
        editor: RawFieldSelector,
        settings: {
          placeholder: NodeGraphDataFrameFieldNames.id,
          frameType: FrameType.edges,
          edgesFrameName: context.options?.edges?.frameName,
        },
      });
      builder.addCustomEditor({
        name: 'Main stat',
        path: 'mainStat',
        id: 'mainStat',
        editor: RawFieldSelector,
        settings: {
          placeholder: NodeGraphDataFrameFieldNames.mainStat,
          frameType: FrameType.edges,
          edgesFrameName: context.options?.edges?.frameName,
        },
      });
      builder.addCustomEditor({
        name: 'Secondary stat',
        path: 'secondaryStat',
        id: 'secondaryStat',
        editor: RawFieldSelector,
        settings: {
          placeholder: NodeGraphDataFrameFieldNames.secondaryStat,
          frameType: FrameType.edges,
          edgesFrameName: context.options?.edges?.frameName,
        },
      });
      builder.addTextInput({
        name: 'Details prefix',
        path: 'details',
        settings: {
          placeholder: NodeGraphDataFrameFieldNames.detail,
          frameType: FrameType.edges,
          edgesFrameName: context.options?.edges?.frameName,
        },
      });
      builder.addCustomEditor({
        name: 'Color',
        path: 'color',
        id: 'color',
        editor: RawFieldSelector,
        settings: {
          placeholder: NodeGraphDataFrameFieldNames.color,
          frameType: FrameType.edges,
          edgesFrameName: context.options?.edges?.frameName,
        },
      });
      builder.addCustomEditor({
        name: 'Target',
        path: 'target',
        id: 'target',
        editor: RawFieldSelector,
        settings: {
          placeholder: NodeGraphDataFrameFieldNames.target,
          frameType: FrameType.edges,
          edgesFrameName: context.options?.edges?.frameName,
        },
      });
      builder.addCustomEditor({
        name: 'Source',
        path: 'source',
        id: 'source',
        editor: RawFieldSelector,
        settings: {
          placeholder: NodeGraphDataFrameFieldNames.source,
          frameType: FrameType.edges,
          edgesFrameName: context.options?.edges?.frameName,
        },
      });
      builder.addCustomEditor({
        name: 'Highlighted',
        path: 'highlighted',
        id: 'highlighted',
        editor: RawFieldSelector,
        settings: {
          placeholder: NodeGraphDataFrameFieldNames.highlighted,
          frameType: FrameType.edges,
          edgesFrameName: context.options?.edges?.frameName,
        },
      });
      builder.addCustomEditor({
        name: 'Thickness',
        path: 'thickness',
        id: 'thickness',
        editor: RawFieldSelector,
        settings: {
          placeholder: NodeGraphDataFrameFieldNames.thickness,
          frameType: FrameType.edges,
          edgesFrameName: context.options?.edges?.frameName,
        },
      });
    },
  });
});
