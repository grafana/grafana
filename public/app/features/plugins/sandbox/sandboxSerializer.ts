import moment from 'moment';

import { DataQueryRequest, DateTime } from '@grafana/data';

import { SandboxQuery } from './sandbox_datasource';
import { SandboxDataQueryRequest } from './types';

export function fromDataQueryRequestToSandboxDataQueryRequest(
  dataQueryRequest: DataQueryRequest<SandboxQuery>
): SandboxDataQueryRequest {
  const rawFrom =
    typeof dataQueryRequest.range.raw.from === 'string'
      ? dataQueryRequest.range.raw.from
      : dataQueryRequest.range.raw.from.toISOString();
  const rawTo =
    typeof dataQueryRequest.range.raw.to === 'string'
      ? dataQueryRequest.range.raw.to
      : dataQueryRequest.range.raw.to.toISOString();

  return {
    ...dataQueryRequest,
    range: {
      from: dataQueryRequest.range.from.toISOString(),
      to: dataQueryRequest.range.to.toISOString(),
      raw: {
        from: rawFrom,
        to: rawTo,
      },
    },
  };
}

export function fromSandboxDataQueryRequestToDataQueryRequest(
  sandboxDataQueryRequest: SandboxDataQueryRequest
): DataQueryRequest<SandboxQuery> {
  return {
    ...sandboxDataQueryRequest,
    range: {
      from: moment(sandboxDataQueryRequest.range.from) as DateTime,
      to: moment(sandboxDataQueryRequest.range.to) as DateTime,
      raw: sandboxDataQueryRequest.range.raw,
    },
  };
}
