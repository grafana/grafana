import React from 'react';

import { TraceSpan } from './trace';

export type SpanLinkDef = {
  href: string;
  onClick?: (event: any) => void;
  content: React.ReactNode;
};

export type SpanLinkFunc = (span: TraceSpan) => SpanLinkDef | undefined;
