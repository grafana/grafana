import { CoreApp, DataQuery, DataSourceInstanceSettings, TimeRange } from '@grafana/data';

interface ActionComponentProps {
  query?: DataQuery;
  queries?: Array<Partial<DataQuery>>;
  onAddQuery?: (q: DataQuery) => void;
  onChangeDataSource?: (ds: DataSourceInstanceSettings) => void;
  timeRange?: TimeRange;
  dataSource?: DataSourceInstanceSettings;
  key: string | number;
}

export type QueryActionComponent = (props: ActionComponentProps) => JSX.Element | null;

type ScopedQueryActionComponent = {
  scope: CoreApp;
  queryActionComponent: QueryActionComponent;
};

class QueryActionComponents {
  extraRenderActions: QueryActionComponent[] = [];
  /* additional actions added in core grafana are likely to be needed in only one kind of app, 
    and the add function may be ran multiple times by the component so it is keyed to ensure uniqueness
  */
  keyedScopedExtraRenderActions: Map<string, ScopedQueryActionComponent> = new Map();

  addExtraRenderAction(extra: QueryActionComponent) {
    this.extraRenderActions = this.extraRenderActions.concat(extra);
  }

  // for adding actions that will need to be unique, even if the add function is ran multiple times
  addKeyedExtraRenderAction(key: string, extra: ScopedQueryActionComponent) {
    this.keyedScopedExtraRenderActions.set(key, extra);
  }

  // only returns actions that are not scoped to a specific CoreApp
  getAllExtraRenderAction(): QueryActionComponent[] {
    return this.extraRenderActions;
  }

  getScopedExtraRenderAction(scope: CoreApp): QueryActionComponent[] {
    const scopedActions = Array.from(this.keyedScopedExtraRenderActions, (value) => value[1]).filter(
      (sra) => sra.scope === scope
    );

    return scopedActions.map((sa) => sa.queryActionComponent);
  }
}

/**
 * @internal and experimental
 */
export const GroupActionComponents = new QueryActionComponents();

/**
 * @internal and experimental
 */
export const RowActionComponents = new QueryActionComponents();
