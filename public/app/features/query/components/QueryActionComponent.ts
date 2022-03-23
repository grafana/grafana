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

  addExtraRenderAction(extra: QueryActionComponent) {
    this.extraRenderActions = this.extraRenderActions.concat(extra);
  }

  getAllExtraRenderAction(): QueryActionComponent[] {
    return this.extraRenderActions;
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
