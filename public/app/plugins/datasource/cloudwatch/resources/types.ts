import { SelectableValue } from '@grafana/data';

import { Dimensions } from '../types';

export interface ResourceResponse<T> {
  accountId?: string;
  value: T;
}

export interface ResourceRequest {
  region: string;
  accountId?: string;
}

export interface GetLogGroupFieldsRequest extends ResourceRequest {
  arn?: string;
  logGroupName: string;
}

export interface GetDimensionKeysRequest extends ResourceRequest {
  metricName?: string;
  namespace?: string;
  dimensionFilters?: Dimensions;
}

export interface GetDimensionValuesRequest extends ResourceRequest {
  dimensionKey: string;
  namespace: string;
  metricName?: string;
  dimensionFilters?: Dimensions;
}

export interface GetMetricsRequest extends ResourceRequest {
  namespace?: string;
}

export interface DescribeLogGroupsRequest extends ResourceRequest {
  logGroupNamePrefix?: string;
  logGroupPattern?: string;
  limit?: number;
  listAllLogGroups?: boolean;
  accountId?: string;
}

export interface Account {
  arn: string;
  id: string;
  label: string;
  isMonitoringAccount: boolean;
}

export interface LogGroupResponse {
  arn: string;
  name: string;
}

export interface MetricResponse {
  name: string;
  namespace: string;
}

export interface SelectableResourceValue extends SelectableValue<string> {
  text: string;
}
