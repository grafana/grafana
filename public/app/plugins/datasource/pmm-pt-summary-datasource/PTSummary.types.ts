export interface PTSummaryRequest {
  node_id: string;
}

export interface DatabaseSummaryRequest {
  pt_mongodb_summary?: {
    service_id: string;
  };
  pt_mysql_summary?: {
    service_id: string;
  };
  pt_postgres_summary?: {
    service_id: string;
  };
}

export interface PTSummaryResponse {
  action_id: string;
  pmm_agent_id: string;
}

export enum DatasourceType {
  postgresql = 'postgresql',
  mongodb = 'mongodb',
  mysql = 'mysql',
  node = 'node',
}
