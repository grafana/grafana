export type SpanDetailOrderLog = {
  name?: string;
  fields?: Array<{ key: string; value: unknown }>;
};

export type SpanDetailOrderSpan = {
  statusCode?: number;
  logs?: SpanDetailOrderLog[];
};

const ERROR_STATUS_CODE = 2;

function isExceptionEvent(log: SpanDetailOrderLog): boolean {
  if (log.name === 'exception') {
    return true;
  }

  return (log.fields ?? []).some((field) => {
    const key = field.key.toLowerCase();
    if (key === 'exception.type' || key === 'exception.message' || key === 'exception.stacktrace') {
      return true;
    }
    return key === 'event' && String(field.value).toLowerCase() === 'exception';
  });
}

// Pin Events above attribute sections when the span is in error, or it carries
// an exception event. Successful spans keep the existing attributes-first order.
export function shouldPinEventsFirst(span: SpanDetailOrderSpan): boolean {
  if (!span.logs?.length) {
    return false;
  }
  if (span.statusCode === ERROR_STATUS_CODE) {
    return true;
  }
  return span.logs.some(isExceptionEvent);
}
