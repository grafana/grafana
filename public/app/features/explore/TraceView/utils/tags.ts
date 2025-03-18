import { SpanStatusCode } from '@opentelemetry/api';
import { uniq } from 'lodash';

import { Trace } from '../components';
import {
  ID,
  KIND,
  LIBRARY_NAME,
  LIBRARY_VERSION,
  STATUS,
  STATUS_MESSAGE,
  TRACE_STATE,
} from '../components/constants/span';

export const getTraceServiceNames = (trace: Trace) => {
  const serviceNames = trace.spans.map((span) => {
    return span.process.serviceName;
  });
  return uniq(serviceNames).sort();
};

export const getTraceSpanNames = (trace: Trace) => {
  const spanNames = trace.spans.map((span) => {
    return span.operationName;
  });
  return uniq(spanNames).sort();
};

export const getTraceTagKeys = (trace: Trace) => {
  let keys: string[] = [];
  let logKeys: string[] = [];

  trace.spans.forEach((span) => {
    span.tags.forEach((tag) => {
      keys.push(tag.key);
    });
    span.process.tags.forEach((tag) => {
      keys.push(tag.key);
    });
    if (span.logs !== null) {
      span.logs.forEach((log) => {
        log.fields.forEach((field) => {
          logKeys.push(field.key);
        });
      });
    }

    if (span.kind) {
      keys.push(KIND);
    }
    if (span.statusCode !== undefined) {
      keys.push(STATUS);
    }
    if (span.statusMessage) {
      keys.push(STATUS_MESSAGE);
    }
    if (span.instrumentationLibraryName) {
      keys.push(LIBRARY_NAME);
    }
    if (span.instrumentationLibraryVersion) {
      keys.push(LIBRARY_VERSION);
    }
    if (span.traceState) {
      keys.push(TRACE_STATE);
    }
    keys.push(ID);
  });
  keys = uniq(keys).sort();
  logKeys = uniq(logKeys).sort();

  return [...keys, ...logKeys];
};

export const getTraceTagValues = (trace: Trace, key: string) => {
  const values: string[] = [];

  trace.spans.forEach((span) => {
    const tagValue = span.tags.find((t) => t.key === key)?.value;
    if (tagValue) {
      values.push(tagValue.toString());
    }
    const processTagValue = span.process.tags.find((t) => t.key === key)?.value;
    if (processTagValue) {
      values.push(processTagValue.toString());
    }
    if (span.logs !== null) {
      span.logs.forEach((log) => {
        const logsTagValue = log.fields.find((t) => t.key === key)?.value;
        if (logsTagValue) {
          values.push(logsTagValue.toString());
        }
      });
    }

    switch (key) {
      case KIND:
        if (span.kind) {
          values.push(span.kind);
        }
        break;
      case STATUS:
        if (span.statusCode !== undefined) {
          values.push(SpanStatusCode[span.statusCode].toLowerCase());
        }
        break;
      case STATUS_MESSAGE:
        if (span.statusMessage) {
          values.push(span.statusMessage);
        }
        break;
      case LIBRARY_NAME:
        if (span.instrumentationLibraryName) {
          values.push(span.instrumentationLibraryName);
        }
        break;
      case LIBRARY_VERSION:
        if (span.instrumentationLibraryVersion) {
          values.push(span.instrumentationLibraryVersion);
        }
        break;
      case TRACE_STATE:
        if (span.traceState) {
          values.push(span.traceState);
        }
        break;
      case ID:
        values.push(span.spanID);
        break;
      default:
        break;
    }
  });

  return uniq(values).sort();
};
