import { type DataSourceApi, type DataSourceInstanceSettings } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';

import { QueryEditorType } from '../../constants';
import { type QueryEditorUIState } from '../QueryEditorContext';
import { type Transformation } from '../types';

export interface QueryActionTarget {
  cardType: QueryEditorType.Query | QueryEditorType.Expression;
  query: DataQuery;
  dsData: { datasource?: DataSourceApi; dsSettings?: DataSourceInstanceSettings } | null;
  dsLoading: boolean;
}

interface TransformationActionTarget {
  cardType: QueryEditorType.Transformation;
  transformation: Transformation;
}

/** The card a set of header actions acts on, which in stacked view is not necessarily the selected one. */
export type HeaderActionTarget = QueryActionTarget | TransformationActionTarget;

export function getSelectedActionTarget({
  selectedQuery,
  selectedTransformation,
  cardType,
  selectedQueryDsData,
  selectedQueryDsLoading,
}: Pick<
  QueryEditorUIState,
  'selectedQuery' | 'selectedTransformation' | 'cardType' | 'selectedQueryDsData' | 'selectedQueryDsLoading'
>): HeaderActionTarget | null {
  if (cardType === QueryEditorType.Alert) {
    return null;
  }

  if (selectedQuery) {
    return {
      cardType: cardType === QueryEditorType.Expression ? QueryEditorType.Expression : QueryEditorType.Query,
      query: selectedQuery,
      dsData: selectedQueryDsData,
      dsLoading: selectedQueryDsLoading,
    };
  }

  if (selectedTransformation) {
    return { cardType: QueryEditorType.Transformation, transformation: selectedTransformation };
  }

  return null;
}
