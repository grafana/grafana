import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DataSourceInstanceSettings, DataSourceSettings } from '@grafana/data';
import { DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';

import { TraceToLogsData, TraceToLogsSettings } from './TraceToLogsSettings';

const defaultOptionsOldFormat: DataSourceSettings<TraceToLogsData> = {
  jsonData: {
    tracesToLogs: {
      datasourceUid: 'loki1_uid',
      tags: ['someTag'],
      mapTagNamesEnabled: false,
      spanStartTimeShift: '1m',
      spanEndTimeShift: '1m',
      filterByTraceID: true,
      filterBySpanID: true,
    },
  },
} as unknown as DataSourceSettings<TraceToLogsData>;

const defaultOptionsNewFormat: DataSourceSettings<TraceToLogsData> = {
  jsonData: {
    tracesToLogsV2: {
      datasourceUid: 'loki1_uid',
      tags: [{ key: 'someTag', value: 'newName' }],
      spanStartTimeShift: '1m',
      spanEndTimeShift: '1m',
      filterByTraceID: true,
      filterBySpanID: true,
      customQuery: true,
      query: '{${__tags}}',
    },
  },
} as unknown as DataSourceSettings<TraceToLogsData>;

const lokiSettings = {
  uid: 'loki1_uid',
  name: 'loki1',
  type: 'loki',
  meta: { info: { logos: { small: '' } } },
} as unknown as DataSourceInstanceSettings;

describe('TraceToLogsSettings', () => {
  beforeAll(() => {
    setDataSourceSrv({
      getList() {
        return [lokiSettings];
      },
      getInstanceSettings() {
        return lokiSettings;
      },
    } as unknown as DataSourceSrv);
  });

  it('should render old format without error', () => {
    expect(() =>
      render(<TraceToLogsSettings options={defaultOptionsOldFormat} onOptionsChange={() => {}} />)
    ).not.toThrow();
  });

  it('should render new format without error', () => {
    expect(() =>
      render(<TraceToLogsSettings options={defaultOptionsNewFormat} onOptionsChange={() => {}} />)
    ).not.toThrow();
  });

  it('should render and transform data from old format correctly', () => {
    render(<TraceToLogsSettings options={defaultOptionsOldFormat} onOptionsChange={() => {}} />);
    expect(screen.getByText('someTag')).toBeInTheDocument();
    expect((screen.getByLabelText('Use custom query') as HTMLInputElement).checked).toBeFalsy();
    expect((screen.getByLabelText('Filter by trace ID') as HTMLInputElement).checked).toBeTruthy();
    expect((screen.getByLabelText('Filter by span ID') as HTMLInputElement).checked).toBeTruthy();
  });

  it('renders old mapped tags correctly', () => {
    const options = {
      ...defaultOptionsOldFormat,
      jsonData: {
        ...defaultOptionsOldFormat.jsonData,
        tracesToLogs: {
          ...defaultOptionsOldFormat.jsonData.tracesToLogs,
          tags: undefined,
          mappedTags: [{ key: 'someTag', value: 'withNewName' }],
          mapTagNamesEnabled: true,
        },
      },
    };

    render(<TraceToLogsSettings options={options} onOptionsChange={() => {}} />);
    expect(screen.getByText('someTag')).toBeInTheDocument();
    expect(screen.getByText('withNewName')).toBeInTheDocument();
  });

  it('transforms old format to new on change', async () => {
    const changeMock = jest.fn();
    render(<TraceToLogsSettings options={defaultOptionsOldFormat} onOptionsChange={changeMock} />);
    const checkBox = screen.getByLabelText('Filter by trace ID');
    await userEvent.click(checkBox);
    expect(changeMock.mock.calls[0]).toEqual([
      {
        jsonData: {
          tracesToLogs: undefined,
          tracesToLogsV2: {
            customQuery: false,
            datasourceUid: 'loki1_uid',
            filterBySpanID: true,
            filterByTraceID: false,
            spanEndTimeShift: '1m',
            spanStartTimeShift: '1m',
            tags: [
              {
                key: 'someTag',
              },
            ],
          },
        },
      },
    ]);
  });
});
