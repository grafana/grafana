import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DataSourceInstanceSettings, type DataSourceSettings } from '@grafana/data';
import { type DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';

import { getTracesToLogsOptions, type TraceToLogsData, TraceToLogsSettings } from './TraceToLogsSettings';

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

const defaultOptionsMultipleDestinations: DataSourceSettings<TraceToLogsData> = {
  jsonData: {
    tracesToLogsV3: [
      {
        name: 'Application logs',
        datasourceUid: 'loki1_uid',
        customQuery: false,
      },
      {
        name: 'Audit logs',
        datasourceUid: 'loki2_uid',
        customQuery: true,
        query: '{cluster="audit"}',
      },
    ],
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

  it('renders multiple destinations with their trace view labels', () => {
    render(<TraceToLogsSettings options={defaultOptionsMultipleDestinations} onOptionsChange={() => {}} />);

    expect(screen.getByDisplayValue('Application logs')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Audit logs')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Remove destination/ })).toHaveLength(2);
    expect(screen.getByRole('group', { name: 'Application logs' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Audit logs' })).toBeInTheDocument();
    expect(screen.getByLabelText('Span start time shift for Application logs')).toBeInTheDocument();
    expect(screen.getByLabelText('Span start time shift for Audit logs')).toBeInTheDocument();
  });

  it('returns legacy configuration as a single destination', () => {
    expect(getTracesToLogsOptions(defaultOptionsOldFormat.jsonData)).toEqual([
      {
        customQuery: false,
        datasourceUid: 'loki1_uid',
        filterBySpanID: true,
        filterByTraceID: true,
        spanEndTimeShift: '1m',
        spanStartTimeShift: '1m',
        tags: [{ key: 'someTag' }],
      },
    ]);
  });

  it('returns V2 configuration as a single destination', () => {
    expect(getTracesToLogsOptions(defaultOptionsNewFormat.jsonData)).toEqual([
      defaultOptionsNewFormat.jsonData.tracesToLogsV2,
    ]);
  });

  it('falls back to V2 configuration when V3 is empty', () => {
    expect(
      getTracesToLogsOptions({
        ...defaultOptionsNewFormat.jsonData,
        tracesToLogsV3: [],
      })
    ).toEqual([defaultOptionsNewFormat.jsonData.tracesToLogsV2]);
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
          tracesToLogsV3: [
            {
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
          ],
        },
      },
    ]);
  });

  it('adds another destination without changing the existing configuration', async () => {
    const changeMock = jest.fn();
    render(<TraceToLogsSettings options={defaultOptionsNewFormat} onOptionsChange={changeMock} />);

    await userEvent.click(screen.getByRole('button', { name: 'Add logs destination' }));

    expect(changeMock).toHaveBeenCalledWith({
      jsonData: {
        tracesToLogs: undefined,
        tracesToLogsV2: defaultOptionsNewFormat.jsonData.tracesToLogsV2,
        tracesToLogsV3: [defaultOptionsNewFormat.jsonData.tracesToLogsV2, { customQuery: false }],
      },
    });
  });

  it('updates a destination other than the first one', () => {
    const changeMock = jest.fn();
    render(<TraceToLogsSettings options={defaultOptionsMultipleDestinations} onOptionsChange={changeMock} />);

    fireEvent.change(screen.getByLabelText('Link 2 label'), { target: { value: 'Security logs' } });

    expect(changeMock).toHaveBeenCalledWith({
      jsonData: {
        tracesToLogs: undefined,
        tracesToLogsV2: defaultOptionsMultipleDestinations.jsonData.tracesToLogsV3![0],
        tracesToLogsV3: [
          defaultOptionsMultipleDestinations.jsonData.tracesToLogsV3![0],
          {
            ...defaultOptionsMultipleDestinations.jsonData.tracesToLogsV3![1],
            name: 'Security logs',
          },
        ],
      },
    });
  });

  it('removes the selected destination', async () => {
    const changeMock = jest.fn();
    render(<TraceToLogsSettings options={defaultOptionsMultipleDestinations} onOptionsChange={changeMock} />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove destination 1' }));

    expect(changeMock).toHaveBeenCalledWith({
      jsonData: {
        tracesToLogs: undefined,
        tracesToLogsV2: defaultOptionsMultipleDestinations.jsonData.tracesToLogsV3![1],
        tracesToLogsV3: [defaultOptionsMultipleDestinations.jsonData.tracesToLogsV3![1]],
      },
    });
  });
});
