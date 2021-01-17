import { DataFrame, Field, FieldCache, FieldType } from '@grafana/data';
import { EdgeDatum, NodeDatum } from './types';

type Line = { x1: number; y1: number; x2: number; y2: number };

/**
 * Makes line shorter while keeping the middle in he same place.
 */
export function shortenLine(line: Line, length: number): Line {
  const vx = line.x2 - line.x1;
  const vy = line.y2 - line.y1;
  const mag = Math.sqrt(vx * vx + vy * vy);
  const ratio = Math.max((mag - length) / mag, 0);
  const vx2 = vx * ratio;
  const vy2 = vy * ratio;
  const xDiff = vx - vx2;
  const yDiff = vy - vy2;
  const newx1 = line.x1 + xDiff / 2;
  const newy1 = line.y1 + yDiff / 2;
  return {
    x1: newx1,
    y1: newy1,
    x2: newx1 + vx2,
    y2: newy1 + vy2,
  };
}

export function getNodeFields(nodes: DataFrame) {
  const fieldsCache = new FieldCache(nodes);
  return {
    id: fieldsCache.getFieldByName('id'),
    title: fieldsCache.getFieldsByLabel(DataFrameLabels.type, DataFrameTypeValues.title)[0],
    subTitle: fieldsCache.getFieldsByLabel(DataFrameLabels.type, DataFrameTypeValues.subTitle)[0],
    mainStat: fieldsCache.getFieldsByLabel(DataFrameLabels.type, DataFrameTypeValues.mainStat)[0],
    secondaryStat: fieldsCache.getFieldsByLabel(DataFrameLabels.type, DataFrameTypeValues.secondaryStat)[0],
    arc: fieldsCache.getFieldsByLabel(DataFrameLabels.type, DataFrameTypeValues.arc),
    details: fieldsCache.getFieldsByLabel(DataFrameLabels.detail, DataFrameDetailValues.true),
  };
}

export function getEdgeFields(edges: DataFrame) {
  const fieldsCache = new FieldCache(edges);
  return {
    id: fieldsCache.getFieldByName('id'),
    source: fieldsCache.getFieldByName('source'),
    target: fieldsCache.getFieldByName('target'),
    mainStat: fieldsCache.getFieldsByLabel(DataFrameLabels.type, DataFrameTypeValues.mainStat)[0],
    secondaryStat: fieldsCache.getFieldsByLabel(DataFrameLabels.type, DataFrameTypeValues.secondaryStat)[0],
    details: fieldsCache.getFieldsByLabel(DataFrameLabels.type, DataFrameDetailValues.true),
  };
}

/**
 * Transform nodes and edges dataframes into array of objects that the layout code can then work with.
 */
export function processNodes(nodes: DataFrame, edges: DataFrame): { nodes: NodeDatum[]; links: EdgeDatum[] } {
  const nodeFields = getNodeFields(nodes);

  const nodesMap =
    nodeFields.id?.values.toArray().reduce<{ [id: string]: NodeDatum }>((acc, id, index) => {
      acc[id] = {
        id: id,
        title: nodeFields.title.values.get(index),
        subTitle: nodeFields.subTitle ? nodeFields.subTitle.values.get(index) : '',
        dataFrameRowIndex: index,
        incoming: 0,
        mainStat: nodeFields.mainStat ? statToString(nodeFields.mainStat, index) : '',
        secondaryStat: nodeFields.secondaryStat ? statToString(nodeFields.secondaryStat, index) : '',
        arcSections: nodeFields.arc.map(f => {
          return {
            value: f.values.get(index),
            color: f.config.color?.fixedColor || '',
          };
        }),
      };
      return acc;
    }, {}) || {};

  const edgeFields = getEdgeFields(edges);
  const edgesMapped = edgeFields.id?.values.toArray().map((id, index) => {
    const target = edgeFields.target?.values.get(index);
    const source = edgeFields.source?.values.get(index);
    // We are adding incoming edges count so we can later on find out which nodes are the roots
    nodesMap[target].incoming++;

    return {
      id,
      dataFrameRowIndex: index,
      source,
      target,
      mainStat: edgeFields.mainStat ? statToString(edgeFields.mainStat, index) : '',
      secondaryStat: edgeFields.secondaryStat ? statToString(edgeFields.secondaryStat, index) : '',
    } as EdgeDatum;
  });

  return {
    nodes: Object.values(nodesMap),
    links: edgesMapped || [],
  };
}

function statToString(field: Field, index: number) {
  if (field.type === FieldType.string) {
    return field.values.get(index);
  } else {
    const decimals = field.config.decimals || 2;
    const val = field.values.get(index);
    if (Number.isFinite(val)) {
      return field.values.get(index).toFixed(decimals) + (field.config.unit ? ' ' + field.config.unit : '');
    } else {
      return '';
    }
  }
}

export const DataFrameLabels = {
  type: 'NodeGraphValueType',
  detail: 'NodeGraphDetailField',
};

export const DataFrameTypeValues = {
  title: 'title',
  subTitle: 'subTitle',
  mainStat: 'mainStat',
  secondaryStat: 'secondaryStat',
  arc: 'arc',
};

export const DataFrameDetailValues = {
  true: 'true',
};
