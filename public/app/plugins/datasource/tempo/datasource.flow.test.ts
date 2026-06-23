import { of } from 'rxjs';

import { type DataQueryRequest } from '@grafana/data';

import { type TempoQuery } from './types';
import { createTempoDatasource } from './test/mocks';

function makeRequest(query: Partial<TempoQuery>): DataQueryRequest<TempoQuery> {
  return {
    targets: [{ refId: 'A', queryType: 'flow', ...query } as TempoQuery],
    scopedVars: {},
  } as unknown as DataQueryRequest<TempoQuery>;
}

describe('TempoDatasource flow table branch', () => {
  it('routes a flow table query through handleTraceQlQuery with the composed filter', () => {
    const ds = createTempoDatasource();
    const spy = jest
      .spyOn(ds, 'handleTraceQlQuery')
      .mockReturnValue(of({ data: [] }));

    ds.query(makeRequest({ flowView: 'table', flowFilters: [{ key: 'direction', values: ['egress'] }] }));

    expect(spy).toHaveBeenCalledTimes(1);
    const passedTargets = spy.mock.calls[0][1].traceql;
    expect(passedTargets[0].query).toBe('{ span.flow.direction = "egress" }');
    expect(passedTargets[0].tableType).toBe('spans');
  });
});
