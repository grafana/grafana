import { Field, LinkModel, TraceSearchProps } from '@grafana/data';
import { SpanLinkFunc } from 'app/features/explore/TraceView/components/types/links';

export interface Options {
  createSpanLink?: SpanLinkFunc;
  focusedSpanId?: string;
  createFocusSpanLink?: (traceId: string, spanId: string) => LinkModel<Field>;
  spanFilters?: TraceSearchProps;
}
