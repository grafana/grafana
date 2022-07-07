import { AzureQueryType } from '../types';

import { getAzureMonitorEvent } from './logging';

describe('AzureMonitor: logging', () => {
  it('return a properly formed event for Azure Monitor metrics', () => {
    const query = {
      refId: 'A',
      queryType: AzureQueryType.AzureMonitor,
      azureMonitor: {
        dimensionFilters: [],
        alias: 'new name for it',
        top: '10',
      },
    };
    expect(getAzureMonitorEvent(query)).toEqual({
      query_type: AzureQueryType.AzureMonitor,
      alias: true,
      top: true,
      dimensions: 0,
    });
  });
  it('return a properly formed event for Logs Analytics', () => {
    const query = {
      refId: 'B',
      queryType: AzureQueryType.LogAnalytics,
      azureLogAnalytics: {
        query: `Perf
        | where $__timeFilter(TimeGenerated)
        | where CounterName == "% Processor Time"
        | summarize avg(CounterValue) by bin(TimeGenerated, 5m), Computer
        | order by TimeGenerated asc`,
        resultFormat: 'table',
      },
    };
    expect(getAzureMonitorEvent(query)).toEqual({
      query_type: AzureQueryType.LogAnalytics,
      format: 'table',
    });
  });
  it('return a properly formed event for Azure resource graph', () => {
    const query = {
      refId: 'C',
      queryType: AzureQueryType.AzureResourceGraph,
      azureResourceGraph: {
        query: 'resources | count ',
        resultFormat: 'table',
      },
    };
    expect(getAzureMonitorEvent(query)).toEqual({
      query_type: AzureQueryType.AzureResourceGraph,
    });
  });
});
