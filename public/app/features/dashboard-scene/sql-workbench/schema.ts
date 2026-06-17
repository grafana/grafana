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

export const githubSchema: DatasourceDef[] = [
  {
    name: 'GitHub',
    type: 'github',
    tables: [
      {
        name: 'repositories',
        columns: [
          { name: 'id', type: 'number' },
          { name: 'name', type: 'label', description: 'Full repo name (org/repo)' },
          { name: 'owner', type: 'label', description: 'Owner login' },
          { name: 'language', type: 'label', description: 'Primary language' },
          { name: 'stargazers_count', type: 'number' },
          { name: 'forks_count', type: 'number' },
          { name: 'open_issues_count', type: 'number' },
          { name: 'created_at', type: 'timestamp' },
        ],
      },
      {
        name: 'pull_requests',
        columns: [
          { name: 'id', type: 'number' },
          { name: 'repository_id', type: 'number' },
          { name: 'title', type: 'label', description: 'PR title' },
          { name: 'state', type: 'label', description: 'open | closed | merged' },
          { name: 'author', type: 'label', description: 'GitHub login of the author' },
          { name: 'review_comments', type: 'number' },
          { name: 'additions', type: 'number' },
          { name: 'deletions', type: 'number' },
          { name: 'created_at', type: 'timestamp' },
          { name: 'merged_at', type: 'timestamp' },
        ],
      },
      {
        name: 'issues',
        columns: [
          { name: 'id', type: 'number' },
          { name: 'repository_id', type: 'number' },
          { name: 'title', type: 'label' },
          { name: 'state', type: 'label', description: 'open | closed' },
          { name: 'author', type: 'label' },
          { name: 'labels', type: 'label', description: 'Comma-separated label names' },
          { name: 'comments', type: 'number' },
          { name: 'created_at', type: 'timestamp' },
          { name: 'closed_at', type: 'timestamp' },
        ],
      },
      {
        name: 'commits',
        columns: [
          { name: 'id', type: 'number' },
          { name: 'repository_id', type: 'number' },
          { name: 'sha', type: 'label', description: '40-char commit SHA' },
          { name: 'author', type: 'label' },
          { name: 'message', type: 'label', description: 'First line of commit message' },
          { name: 'additions', type: 'number' },
          { name: 'deletions', type: 'number' },
          { name: 'committed_at', type: 'timestamp' },
        ],
      },
      {
        name: 'workflow_runs',
        columns: [
          { name: 'id', type: 'number' },
          { name: 'repository_id', type: 'number' },
          { name: 'workflow_name', type: 'label' },
          { name: 'status', type: 'label', description: 'queued | in_progress | completed' },
          { name: 'conclusion', type: 'label', description: 'success | failure | cancelled | skipped' },
          { name: 'run_number', type: 'number' },
          { name: 'created_at', type: 'timestamp' },
          { name: 'updated_at', type: 'timestamp' },
        ],
      },
    ],
  },
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
