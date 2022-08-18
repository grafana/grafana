import React from 'react';

import { TraceSpan } from './trace';

export type SpanLinkDef = {
  href: string;
  onClick?: (event: any) => void;
  content: React.ReactNode;
  title?: string;
};

export type SpanLinks = {
  logLinks?: SpanLinkDef[];
  traceLinks?: SpanLinkDef[];
  metricLinks?: SpanLinkDef[];
};

export type SpanLinkFunc = (span: TraceSpan) => SpanLinks | undefined;
