// Hand-written shapes of the MT responses the MT source reads. Only the fields it uses are typed.

/** An item of `GET apis/query.grafana.app/v0alpha1/namespaces/{ns}/connections`. */
export interface DataSourceConnection {
  /** The data source name. */
  title: string;
  /** The data source uid. */
  name: string;
  /** The API group of the per-uid resource, e.g. `prometheus.datasource.grafana.app`. */
  group: string;
  /** The plugin type as stored on the data source. Can be an alias of the plugin id. */
  plugin?: string;
  labels?: Record<string, string>;
}

export interface DataSourceConnectionList {
  items: DataSourceConnection[];
  /** `continue` is set when more pages follow. */
  metadata?: { continue?: string };
}

/** `GET apis/{group}/{version}/namespaces/{ns}/datasources/{uid}`. */
export interface DataSourceResource {
  metadata: {
    name: string;
    labels?: Record<string, string>;
  };
  spec: {
    title: string;
    access?: 'proxy' | 'direct';
    url?: string;
    database?: string;
    user?: string;
    basicAuth?: boolean;
    basicAuthUser?: string;
    withCredentials?: boolean;
    readOnly?: boolean;
    jsonData?: Record<string, unknown>;
  };
}

/** A page of `GET apis/{group}/{version}/namespaces/{ns}/datasources`. */
export interface DataSourceResourceList {
  items?: DataSourceResource[];
  /** `continue` is set when more pages follow. */
  metadata?: { continue?: string };
}
