import moment from 'moment';

import { DataQueryRequest, DateTime, TimeRange } from '@grafana/data';

import { SandboxQuery } from './sandbox_datasource';
import { SandboxDataQueryRequest } from './types';

export function fromDataQueryRequestToSandboxDataQueryRequest(
  dataQueryRequest: DataQueryRequest<SandboxQuery>
): SandboxDataQueryRequest {
  return {
    ...dataQueryRequest,
    range: serializeRangeToString(dataQueryRequest.range),
  };
}

export function fromSandboxDataQueryRequestToDataQueryRequest(
  sandboxDataQueryRequest: SandboxDataQueryRequest
): DataQueryRequest<SandboxQuery> {
  return {
    ...sandboxDataQueryRequest,
    range: deserializeRangeFromString(sandboxDataQueryRequest.range),
  };
}

export function serializeRangeToString(range: TimeRange) {
  const rawFrom = typeof range.raw.from === 'string' ? range.raw.from : range.raw.from.toISOString();
  const rawTo = typeof range.raw.to === 'string' ? range.raw.to : range.raw.to.toISOString();

  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    raw: {
      from: rawFrom,
      to: rawTo,
    },
  };
}

export function deserializeRangeFromString(range: {
  from: string;
  to: string;
  raw: { from: string; to: string };
}): TimeRange {
  return {
    from: moment(range.from) as DateTime,
    to: moment(range.to) as DateTime,
    raw: range.raw,
  };
}
