import { type DataQuery } from '@grafana/schema';
import { type DataSourceJsonData } from '@grafana/data';

export interface DockerQuery extends DataQuery {
    resourceType: 'container_stats' | 'system_df' | "all_containers_info";
    containerId?: string;
    streaming?: boolean;
} // TODO


export interface DockerOptions extends DataSourceJsonData {
} // TODO

export type DockerContainer = {
  Id: string;
  Names: string[];
};


export type ContainerOption = {
  label: string;
  value: string;
};
