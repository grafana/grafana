import { type AlertState } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';
import { type ExpressionQuery } from 'app/features/expressions/types';

import { type AlertRule, type Transformation } from './QueryEditor/types';
import { getEditorType } from './QueryEditor/utils';
import { QueryEditorType } from './constants';

export interface ActionItem {
  id: string;
  type: QueryEditorType;
  isHidden: boolean;
  error?: string;
  /** Alert state for dynamic styling (only used when type is Alert) */
  alertState?: AlertState | null;
}

export function getActionItemKey({ id, type }: ActionItem): string {
  return `${type}:${id}`;
}

interface QueryActionItemOptions {
  error?: string;
  type?: QueryEditorType;
}

export function queryToActionItem(
  query: DataQuery | ExpressionQuery,
  options: QueryActionItemOptions = {}
): ActionItem {
  const { error, type = getEditorType(query) } = options;

  return {
    id: query.refId,
    type,
    isHidden: query.hide ?? false,
    error,
  };
}

export function transformationToActionItem(transformation: Transformation): ActionItem {
  return {
    id: transformation.transformId,
    type: QueryEditorType.Transformation,
    isHidden: !!transformation.transformConfig.disabled,
  };
}

export function alertToActionItem(alert: AlertRule): ActionItem {
  return {
    id: alert.alertId,
    type: QueryEditorType.Alert,
    isHidden: false,
    alertState: alert.state,
  };
}
