import { DataQuery, DataSourceInstanceSettings, TimeRange } from '@grafana/data';

interface ActionComponentProps {
  query?: DataQuery;
  queries?: Array<Partial<DataQuery>>;
  onAddQuery?: (q: DataQuery) => void;
  onChangeDataSource?: (ds: DataSourceInstanceSettings) => void;
  timeRange?: TimeRange;
  dataSource?: DataSourceInstanceSettings;
  key: string | number;
}

type QueryActionComponent = (props: ActionComponentProps) => JSX.Element | null;

class QueryActionComponents {
  extraRenderActions: QueryActionComponent[] = [];
  keyedExtraRenderActions: Map<string, QueryActionComponent> = new Map();

  addExtraRenderAction(extra: QueryActionComponent) {
    this.extraRenderActions = this.extraRenderActions.concat(extra);
  }

  // for adding actions that need to be unique, but also need component context that may be fired multiple times
  addKeyedExtraRenderAction(key: string, extra: QueryActionComponent) {
    this.keyedExtraRenderActions.set(key, extra);
  }

  getAllExtraRenderAction(): QueryActionComponent[] {
    return [...this.extraRenderActions, ...Array.from(this.keyedExtraRenderActions, (value) => value[1])];
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
