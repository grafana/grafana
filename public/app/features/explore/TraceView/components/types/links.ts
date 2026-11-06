import type * as React from 'react';

import {
  type DataSourceInstanceSettings,
  type DataSourceJsonData,
  type IconName,
  type Field,
  type LinkModel,
  type LinkTarget,
} from '@grafana/data';
import { type TraceToLogsOptionsV2 } from '@grafana/o11y-ds-frontend';

import { type TraceSpan } from './trace';

export enum SpanLinkType {
  Logs = 'log',
  Traces = 'trace',
  Metrics = 'metric',
  Profiles = 'profile',
  ProfilesDrilldown = 'profile-drilldown',
  Session = 'session',
  Unknown = 'unknown',
}

export type SpanLinkDef = {
  href: string;
  onClick?: (event: unknown) => void;
  content: React.ReactNode;
  title?: string;
  field: Field;
  type: SpanLinkType;
  target?: LinkTarget;
  linkModel?: LinkModel;
  logsDestination?: LogsDestinationLink;
};

/**
 * A configured trace to logs destination whose logs data source is resolved.
 */
export type TraceToLogsDestination = {
  /** Position of the destination in the trace data source configuration. */
  index: number;
  options: TraceToLogsOptionsV2;
  settings: DataSourceInstanceSettings<DataSourceJsonData>;
  /** More than one destination has a data source configured, whether or not the others resolve. */
  isOneOfMany?: boolean;
};

export type LogsDestinationLink = {
  options: TraceToLogsOptionsV2;
  /**
   * More than one logs destination is configured. Each link then keeps its own label and stays on its configured
   * data source instead of falling back to other Loki data sources.
   */
  isOneOfMany: boolean;
};

export type SpanLinkModel = {
  linkModel: LinkModel;
  icon: IconName;
  className?: string;
  type: SpanLinkType;
  traceDatasourceUid?: string;
  logsDestination?: LogsDestinationLink;
};

export type SpanLinkFunc = (span: TraceSpan) => SpanLinkDef[] | undefined;
