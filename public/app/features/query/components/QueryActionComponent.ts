import { DataQuery } from '@grafana/data';

export interface QueryActionComponentProps {
  query?: DataQuery;
  queries?: DataQuery[];
}

export type QueryActionComponent = React.ComponentType<QueryActionComponentProps>;

let extraRenderQueryActions: QueryActionComponent[] = [];

export function addExtraRenderQueryAction(extra: QueryActionComponent) {
  extraRenderQueryActions = extraRenderQueryActions.concat(extra);
}

export function getAllExtraRenderQueryAction(): QueryActionComponent[] {
  return extraRenderQueryActions;
}
