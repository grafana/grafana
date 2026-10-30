import {
  type DataFrame,
  type DataQueryRequest,
  type DataTransformerConfig,
  type TransformerCategory,
} from '@grafana/data';

export interface TransformationsEditorTransformation {
  transformation: DataTransformerConfig;
  id: string;
}

export const VIEW_ALL_VALUE = 'viewAll';
type viewAllType = 'viewAll';
export type FilterCategory = TransformerCategory | viewAllType;

export interface TransformationData {
  request?: DataQueryRequest;
  series: DataFrame[];
  annotations?: DataFrame[];
}
