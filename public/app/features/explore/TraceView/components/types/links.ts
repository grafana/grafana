import * as React from 'react';

import { Field, LinkTarget } from '@grafana/data';

import { TraceSpan } from './trace';

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
};

export type SpanLinkFunc = (span: TraceSpan) => SpanLinkDef[] | undefined;
