import React from 'react';

import { Field } from '@grafana/data';

import { TraceSpan } from './trace';

export enum SpanLinkType {
  Logs = 'log',
  Traces = 'trace',
  Metrics = 'metric',
  Unknown = 'unknown',
}

export type SpanLinkDef = {
  href: string;
  onClick?: (event: unknown) => void;
  content: React.ReactNode;
  title?: string;
  field: Field;
  type: SpanLinkType;
};

export type SpanLinkFunc = (span: TraceSpan) => SpanLinkDef[] | undefined;
