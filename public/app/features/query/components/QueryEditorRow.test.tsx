import React from 'react';
import { DataQuery, DataQueryRequest, dateTime, LoadingState, PanelData, toDataFrame } from '@grafana/data';
import { render, waitFor, screen } from '@testing-library/react';
import { filterPanelDataToQuery, QueryEditorRow, Props as QueryEditorRowProps } from './QueryEditorRow';
import { getDataSourceSrv, setDataSourceSrv, config } from '@grafana/runtime';

function makePretendRequest(requestId: string, subRequests?: DataQueryRequest[]): DataQueryRequest {
  return {
    requestId,
    // subRequests,
  } as DataQueryRequest;
}

describe('filterPanelDataToQuery', () => {
  const data: PanelData = {
    state: LoadingState.Done,
    series: [
      toDataFrame({ refId: 'A', fields: [{ name: 'AAA' }], meta: {} }),
      toDataFrame({ refId: 'B', fields: [{ name: 'B111' }], meta: {} }),
      toDataFrame({ refId: 'B', fields: [{ name: 'B222' }], meta: {} }),
      toDataFrame({ refId: 'B', fields: [{ name: 'B333' }], meta: {} }),
      toDataFrame({ refId: 'C', fields: [{ name: 'CCCC' }], meta: { requestId: 'sub3' } }),
    ],
    error: {
      refId: 'B',
      message: 'Error!!',
    },
    request: makePretendRequest('111', [
      makePretendRequest('sub1'),
      makePretendRequest('sub2'),
      makePretendRequest('sub3'),
    ]),
    timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1d', to: 'now' } },
  };

  it('should not have an error unless the refId matches', () => {
    const panelData = filterPanelDataToQuery(data, 'A');
    expect(panelData?.series.length).toBe(1);
    expect(panelData?.series[0].refId).toBe('A');
    expect(panelData?.error).toBeUndefined();
  });

  it('should match the error to the query', () => {
    const panelData = filterPanelDataToQuery(data, 'B');
    expect(panelData?.series.length).toBe(3);
    expect(panelData?.series[0].refId).toBe('B');
    expect(panelData?.error!.refId).toBe('B');
  });

  it('should include errors when missing data', () => {
    const withError = ({
      series: [],
      error: {
        message: 'Error!!',
      },
    } as unknown) as PanelData;

    const panelData = filterPanelDataToQuery(withError, 'B');
    expect(panelData).toBeDefined();

    // @ts-ignore typescript doesn't understand that panelData can't be undefined here
    expect(panelData.state).toBe(LoadingState.Error);
    // @ts-ignore typescript doesn't understand that panelData can't be undefined here
    expect(panelData.error).toBe(withError.error);
  });
});

describe('queryModal', () => {
  it('should display a create recorded query button when recorded query feature flag is active and hasLicence', async () => {
    const datasource = {
      name: 'Testdata',
      meta: {
        type: 'datasource',
        name: 'TestData',
        id: 'testdata',
      },
    };
    setDataSourceSrv({
      getInstanceSettings(name: string) {
        return {
          name: datasource.name,
          value: datasource.name,
          meta: datasource.meta,
        };
      },
      get(name: string) {
        return Promise.resolve(datasource);
      },
    } as any);

    config.licenseInfo.hasLicense = true;
    config.featureToggles.recordedQueries = true;

    const ds = getDataSourceSrv().getInstanceSettings('');
    const queries: DataQuery[] = [{ refId: 'A', datasource: JSON.stringify(ds) }];
    const props = ({
      query: queries[0],
      queries: queries,
      id: 'id',
      index: 0,
      dataSource: ds,
      draggable: false,
    } as any) as QueryEditorRowProps<DataQuery>;

    render(<QueryEditorRow {...props} />);

    await waitFor(() => {
      expect(screen.getByTitle('Record Query')).toBeVisible();
    });
  });
});
