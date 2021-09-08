import { DataQuery } from '@grafana/data';

export interface QueryActionComponentProps {
  query?: DataQuery;
  queries?: Array<Partial<DataQuery>>;
  onAddQuery?: (q: Partial<DataQuery>) => void;
}

export type QueryActionComponent = React.ComponentType<QueryActionComponentProps>;

let extraRenderQueryActions: QueryActionComponent[] = [];

/**
 * @internal and experimental
 */
export function addExtraRenderQueryAction(extra: QueryActionComponent) {
  extraRenderQueryActions = extraRenderQueryActions.concat(extra);
}

/**
 * @internal and experimental
 */
export function getAllExtraRenderQueryAction(): QueryActionComponent[] {
  return extraRenderQueryActions;
}
