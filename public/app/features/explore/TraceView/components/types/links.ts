import React from 'react';

import { Field } from '@grafana/data';

import { TraceSpan } from './trace';

export type SpanLinkDef = {
  href: string;
  onClick?: (event: unknown) => void;
  content: React.ReactNode;
  title?: string;
  field: Field;
};

export type SpanLinks = {
  logLinks?: SpanLinkDef[];
  traceLinks?: SpanLinkDef[];
  metricLinks?: SpanLinkDef[];
};

export type SpanLinkFunc = (span: TraceSpan) => SpanLinks | undefined;
