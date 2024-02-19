import { DataFrame, FieldCache, FieldColorModeId, NodeGraphDataFrameFieldNames } from '@grafana/data';
import { GraphFrame } from '@grafana/nodegraph';

import { Options as NodeGraphOptions } from './panelcfg.gen';

export function getNodeGraphDataFrames(frames: DataFrame[], options?: NodeGraphOptions) {
  // TODO: this not in sync with how other types of responses are handled. Other types have a query response
  //  processing pipeline which ends up populating redux state with proper data. As we move towards more dataFrame
  //  oriented API it seems like a better direction to move such processing into to visualisations and do minimal
  //  and lazy processing here. Needs bigger refactor so keeping nodeGraph and Traces as they are for now.
  let nodeGraphFrames = frames.filter((frame) => {
    if (frame.meta?.preferredVisualisationType === 'nodeGraph') {
      return true;
    }

    if (frame.name === 'nodes' || frame.name === 'edges' || frame.refId === 'nodes' || frame.refId === 'edges') {
      return true;
    }

    const fieldsCache = new FieldCache(frame);
    if (fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.id)) {
      return true;
    }

    return false;
  });

  // If panel options are provided, interpolate their values in to the data frames
  if (options) {
    nodeGraphFrames = applyOptionsToFrames(nodeGraphFrames, options);
  }
  return nodeGraphFrames;
}

export const applyOptionsToFrames = (frames: DataFrame[], options: NodeGraphOptions): DataFrame[] => {
  return frames.map((frame) => {
    const fieldsCache = new FieldCache(frame);

    // Edges frame has source which can be used to identify nodes vs edges frames
    if (fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.source.toLowerCase())) {
      if (options?.edges?.mainStatUnit) {
        const field = frame.fields.find((field) => field.name.toLowerCase() === NodeGraphDataFrameFieldNames.mainStat);
        if (field) {
          field.config = { ...field.config, unit: options.edges.mainStatUnit };
        }
      }
      if (options?.edges?.secondaryStatUnit) {
        const field = frame.fields.find(
          (field) => field.name.toLowerCase() === NodeGraphDataFrameFieldNames.secondaryStat
        );
        if (field) {
          field.config = { ...field.config, unit: options.edges.secondaryStatUnit };
        }
      }
    } else {
      if (options?.nodes?.mainStatUnit) {
        const field = frame.fields.find((field) => field.name.toLowerCase() === NodeGraphDataFrameFieldNames.mainStat);
        if (field) {
          field.config = { ...field.config, unit: options.nodes.mainStatUnit };
        }
      }
      if (options?.nodes?.secondaryStatUnit) {
        const field = frame.fields.find(
          (field) => field.name.toLowerCase() === NodeGraphDataFrameFieldNames.secondaryStat
        );
        if (field) {
          field.config = { ...field.config, unit: options.nodes.secondaryStatUnit };
        }
      }
      if (options?.nodes?.arcs?.length) {
        for (const arc of options.nodes.arcs) {
          const field = frame.fields.find((field) => field.name.toLowerCase() === arc.field);
          if (field && arc.color) {
            field.config = { ...field.config, color: { fixedColor: arc.color, mode: FieldColorModeId.Fixed } };
          }
        }
      }
    }
    return frame;
  });
};

export const getGraphFrame = (frames: DataFrame[]) => {
  return frames.reduce<GraphFrame>(
    (acc, frame) => {
      const sourceField = frame.fields.filter((f) => f.name === 'source');
      if (frame.name === 'edges' || sourceField.length) {
        acc.edges.push(frame);
      } else {
        acc.nodes.push(frame);
      }
      return acc;
    },
    { edges: [], nodes: [] }
  );
};
