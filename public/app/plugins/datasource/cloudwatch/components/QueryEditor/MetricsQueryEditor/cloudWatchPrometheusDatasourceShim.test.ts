import { PrometheusCacheLevel } from '@grafana/prometheus';

import { type CloudWatchDatasource } from '../../../datasource';

import { makeCloudWatchPrometheusDatasourceShim } from './cloudWatchPrometheusDatasourceShim';

describe('makeCloudWatchPrometheusDatasourceShim', () => {
  function makeFakeDatasource() {
    const templateSrv = { replace: jest.fn().mockReturnValue('interpolated') };
    const getVariables = jest.fn().mockReturnValue(['$foo', '$bar']);
    const datasource = { templateSrv, getVariables } as unknown as CloudWatchDatasource;
    return { datasource, templateSrv, getVariables };
  }

  it('delegates interpolateString to the datasource templateSrv', () => {
    const { datasource, templateSrv } = makeFakeDatasource();
    const shim = makeCloudWatchPrometheusDatasourceShim(datasource);

    const result = shim.interpolateString('$myVar', { foo: { text: 'a', value: 'a' } });

    expect(templateSrv.replace).toHaveBeenCalledWith('$myVar', { foo: { text: 'a', value: 'a' } });
    expect(result).toBe('interpolated');
  });

  it('delegates getVariables to the datasource', () => {
    const { datasource, getVariables } = makeFakeDatasource();
    const shim = makeCloudWatchPrometheusDatasourceShim(datasource);

    expect(shim.getVariables()).toEqual(['$foo', '$bar']);
    expect(getVariables).toHaveBeenCalled();
  });

  it('enables metric and label lookups', () => {
    const { datasource } = makeFakeDatasource();
    const shim = makeCloudWatchPrometheusDatasourceShim(datasource);
    expect(shim.lookupsDisabled).toBe(false);
  });

  it('sets cacheLevel to None and provides getAdjustedInterval for the resource client', () => {
    const { datasource } = makeFakeDatasource();
    const shim = makeCloudWatchPrometheusDatasourceShim(datasource);
    expect(shim.cacheLevel).toBe(PrometheusCacheLevel.None);
    expect(typeof shim.getAdjustedInterval).toBe('function');
  });

  it('exposes getQueryHints and modifyQuery so the builder hint panel can render fixes', () => {
    const { datasource } = makeFakeDatasource();
    const shim = makeCloudWatchPrometheusDatasourceShim(datasource);

    expect(typeof shim.getQueryHints).toBe('function');
    expect(typeof shim.modifyQuery).toBe('function');
  });

  it('returns an APPLY_RATE hint for a counter-suffixed metric so the rate hint button surfaces', () => {
    const { datasource } = makeFakeDatasource();
    const shim = makeCloudWatchPrometheusDatasourceShim(datasource);

    const hints = shim.getQueryHints({ refId: 'A', expr: 'apiserver_request_total' }, []);
    expect(hints.some((hint) => hint.type === 'APPLY_RATE' && hint.fix?.action?.type === 'ADD_RATE')).toBe(true);
  });

  it('applies an ADD_RATE action via the upstream modifyQuery', () => {
    const { datasource } = makeFakeDatasource();
    const shim = makeCloudWatchPrometheusDatasourceShim(datasource);

    const result = shim.modifyQuery({ refId: 'A', expr: 'my_metric' }, { type: 'ADD_RATE' });
    expect(result.expr).toBe('rate(my_metric[$__rate_interval])');
  });
});
