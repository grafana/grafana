export interface ColumnDef {
  name: string;
  type: 'timestamp' | 'value' | 'label' | 'number';
  description?: string;
}

export interface TableDef {
  name: string;
  columns: ColumnDef[];
}

export interface DatasourceDef {
  name: string;
  type: string;
  tables: TableDef[];
}

const prometheusLabels: ColumnDef[] = [
  { name: 'timestamp', type: 'timestamp', description: 'Unix timestamp in seconds' },
  { name: 'value', type: 'value', description: 'Metric value' },
  { name: 'instance', type: 'label', description: 'Target instance (host:port)' },
  { name: 'job', type: 'label', description: 'Job name that scraped this metric' },
];

export const mockSchema: DatasourceDef[] = [
  {
    name: 'Prometheus',
    type: 'prometheus',
    tables: [
      {
        name: 'http_server_requests_seconds_count',
        columns: [
          ...prometheusLabels,
          { name: 'method', type: 'label', description: 'HTTP method (GET, POST, …)' },
          { name: 'status', type: 'label', description: 'HTTP status code' },
          { name: 'path', type: 'label', description: 'Request URI path' },
          { name: 'handler', type: 'label', description: 'Handler function name' },
        ],
      },
      {
        name: 'http_server_requests_seconds_bucket',
        columns: [
          ...prometheusLabels,
          { name: 'le', type: 'label', description: 'Histogram upper bound (seconds)' },
          { name: 'method', type: 'label' },
          { name: 'status', type: 'label' },
          { name: 'path', type: 'label' },
        ],
      },
      {
        name: 'http_server_requests_seconds_sum',
        columns: [...prometheusLabels, { name: 'method', type: 'label' }, { name: 'status', type: 'label' }],
      },
      {
        name: 'node_cpu_seconds_total',
        columns: [
          ...prometheusLabels,
          { name: 'cpu', type: 'label', description: 'CPU core index' },
          { name: 'mode', type: 'label', description: 'CPU mode: idle, user, system, iowait' },
        ],
      },
      {
        name: 'node_memory_MemAvailable_bytes',
        columns: [...prometheusLabels],
      },
      {
        name: 'node_memory_MemTotal_bytes',
        columns: [...prometheusLabels],
      },
      {
        name: 'process_resident_memory_bytes',
        columns: [...prometheusLabels],
      },
      {
        name: 'process_cpu_seconds_total',
        columns: [...prometheusLabels],
      },
      {
        name: 'grpc_server_handled_total',
        columns: [
          ...prometheusLabels,
          { name: 'grpc_method', type: 'label' },
          { name: 'grpc_service', type: 'label' },
          { name: 'grpc_code', type: 'label' },
        ],
      },
      {
        name: 'grpc_server_handling_seconds_bucket',
        columns: [
          ...prometheusLabels,
          { name: 'le', type: 'label' },
          { name: 'grpc_method', type: 'label' },
          { name: 'grpc_service', type: 'label' },
        ],
      },
      {
        name: 'go_goroutines',
        columns: [...prometheusLabels],
      },
      {
        name: 'go_gc_duration_seconds',
        columns: [...prometheusLabels, { name: 'quantile', type: 'label' }],
      },
    ],
  },
];
