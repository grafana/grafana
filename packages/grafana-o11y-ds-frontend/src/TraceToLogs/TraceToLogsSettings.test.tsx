import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DataSourceInstanceSettings, type DataSourceSettings } from '@grafana/data';
import { type DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';

import {
  getTraceToLogsDestinations,
  getTraceToLogsOptions,
  type TraceToLogsData,
  type TraceToLogsOptionsV2,
  TraceToLogsSettings,
} from './TraceToLogsSettings';

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

  it('should render old format without error', async () => {
    expect(() =>
      render(<TraceToLogsSettings options={defaultOptionsOldFormat} onOptionsChange={() => {}} />)
    ).not.toThrow();
    // Flush the DataSourcePicker's pending default-data-source resolution.
    await act(async () => {});
  });

  it('should render new format without error', async () => {
    expect(() =>
      render(<TraceToLogsSettings options={defaultOptionsNewFormat} onOptionsChange={() => {}} />)
    ).not.toThrow();
    await act(async () => {});
  });

  it('should render and transform data from old format correctly', async () => {
    render(<TraceToLogsSettings options={defaultOptionsOldFormat} onOptionsChange={() => {}} />);
    await act(async () => {});
    expect(screen.getByText('someTag')).toBeInTheDocument();
    expect((screen.getByLabelText('Use custom query') as HTMLInputElement).checked).toBeFalsy();
    expect((screen.getByLabelText('Filter by trace ID') as HTMLInputElement).checked).toBeTruthy();
    expect((screen.getByLabelText('Filter by span ID') as HTMLInputElement).checked).toBeTruthy();
  });

  it('renders old mapped tags correctly', async () => {
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
    await act(async () => {});
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

  describe('multiple destinations', () => {
    const first = { customQuery: false, datasourceUid: 'loki1_uid', filterByTraceID: true };
    const second = { customQuery: true, datasourceUid: 'audit_uid', query: '{job="audit"}', name: 'Audit' };
    const withJsonData = (jsonData: TraceToLogsData) =>
      ({ jsonData }) as unknown as DataSourceSettings<TraceToLogsData>;

    it('shows only the first destination and keeps additional ones on edit without the opt-in', async () => {
      const changeMock = jest.fn();
      render(
        <TraceToLogsSettings
          options={withJsonData({ tracesToLogsV2: first, tracesToLogsAdditional: [second] })}
          onOptionsChange={changeMock}
        />
      );
      await act(async () => {});

      expect(screen.getAllByRole('switch', { name: 'Filter by trace ID' })).toHaveLength(1);
      expect(screen.queryByLabelText('Link label')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Add logs destination' })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('switch', { name: 'Filter by trace ID' }));

      expect(changeMock).toHaveBeenCalledWith(
        withJsonData({
          tracesToLogsV2: { ...first, filterByTraceID: false },
          tracesToLogsAdditional: [second],
          tracesToLogs: undefined,
        })
      );
    });

    it('adds an empty destination after the existing one and offers no removal for a lone destination', async () => {
      const changeMock = jest.fn();
      render(
        <TraceToLogsSettings
          options={withJsonData({ tracesToLogsV2: first })}
          onOptionsChange={changeMock}
          allowMultipleDestinations
        />
      );
      await act(async () => {});

      expect(screen.getByLabelText('Link label')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Remove destination/ })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Add logs destination' }));

      expect(changeMock).toHaveBeenCalledWith(
        withJsonData({
          tracesToLogs: undefined,
          tracesToLogsV2: first,
          tracesToLogsAdditional: [{ customQuery: false }],
        })
      );
    });

    it('moves the second destination into tracesToLogsV2 when the first one is removed', async () => {
      const changeMock = jest.fn();
      render(
        <TraceToLogsSettings
          options={withJsonData({ tracesToLogsV2: first, tracesToLogsAdditional: [second] })}
          onOptionsChange={changeMock}
          allowMultipleDestinations
        />
      );
      await act(async () => {});

      await userEvent.click(screen.getByRole('button', { name: 'Remove destination 1' }));

      expect(changeMock).toHaveBeenCalledWith(
        withJsonData({ tracesToLogs: undefined, tracesToLogsV2: second, tracesToLogsAdditional: undefined })
      );
    });

    it('keeps the promoted destination tag when its editor is opened and blurred', async () => {
      const user = userEvent.setup();
      const changeMock = jest.fn();
      const first = {
        customQuery: false,
        datasourceUid: 'loki1_uid',
        tags: [{ key: 'app.tag', value: 'app_label' }],
      };
      const second = {
        customQuery: false,
        datasourceUid: 'loki1_uid',
        tags: [{ key: 'audit.tag', value: 'audit_label' }],
      };
      const options = withJsonData({ tracesToLogsV2: first, tracesToLogsAdditional: [second] });

      const { rerender } = render(
        <TraceToLogsSettings options={options} onOptionsChange={changeMock} allowMultipleDestinations />
      );
      await act(async () => {});

      await user.click(screen.getByRole('button', { name: 'Remove destination 1' }));

      const promotedOptions = changeMock.mock.lastCall![0];
      rerender(
        <TraceToLogsSettings options={promotedOptions} onOptionsChange={changeMock} allowMultipleDestinations />
      );
      changeMock.mockClear();

      await user.click(screen.getByText('audit.tag'));
      await user.tab();

      expect(changeMock).toHaveBeenLastCalledWith({
        ...promotedOptions,
        jsonData: {
          ...promotedOptions.jsonData,
          tracesToLogsV2: second,
        },
      });
    });

    it('keeps externally added destinations distinct after removing fallback-keyed siblings', async () => {
      const user = userEvent.setup();
      const changeMock = jest.fn();
      const a = { customQuery: false, tags: [{ key: 'a.tag', value: 'a_label' }] };
      const b = { customQuery: false, tags: [{ key: 'b.tag', value: 'b_label' }] };
      const c = { customQuery: false, tags: [{ key: 'c.tag', value: 'c_label' }] };
      const d = { customQuery: false, tags: [{ key: 'd.tag', value: 'd_label' }] };
      const editor = (options: DataSourceSettings<TraceToLogsData>) => (
        <TraceToLogsSettings options={options} onOptionsChange={changeMock} allowMultipleDestinations />
      );
      const errors = jest.spyOn(console, 'error').mockImplementation(() => {});

      try {
        const { rerender } = render(editor(withJsonData({ tracesToLogsV2: a })));
        await act(async () => {});

        rerender(editor(withJsonData({ tracesToLogsV2: a, tracesToLogsAdditional: [b, c] })));
        await user.click(screen.getByRole('button', { name: 'Remove destination 2' }));
        rerender(editor(changeMock.mock.lastCall![0]));

        rerender(editor(withJsonData({ tracesToLogsV2: a, tracesToLogsAdditional: [c, d] })));
        await user.click(screen.getByRole('button', { name: 'Remove destination 2' }));
        const survivingOptions = changeMock.mock.lastCall![0];
        rerender(editor(survivingOptions));
        changeMock.mockClear();

        await user.click(screen.getByText('d.tag'));
        await user.tab();

        expect(changeMock.mock.lastCall![0].jsonData.tracesToLogsAdditional).toEqual([d]);
        expect(errors).not.toHaveBeenCalled();
      } finally {
        errors.mockRestore();
      }
    });

    it('edits the link label of an additional destination and keeps the original ids on the first one', async () => {
      const changeMock = jest.fn();
      render(
        <TraceToLogsSettings
          options={withJsonData({ tracesToLogsV2: first, tracesToLogsAdditional: [{ ...second, name: '' }] })}
          onOptionsChange={changeMock}
          allowMultipleDestinations
        />
      );
      await act(async () => {});

      expect(document.getElementById('filterByTraceID')).toBeInTheDocument();
      expect(document.getElementById('filterByTraceID-1')).toBeInTheDocument();

      await userEvent.type(document.getElementById('trace-to-logs-link-label-1')!, 'A');

      expect(changeMock).toHaveBeenLastCalledWith(
        withJsonData({
          tracesToLogs: undefined,
          tracesToLogsV2: first,
          tracesToLogsAdditional: [{ ...second, name: 'A' }],
        })
      );
    });
  });
});

describe('getTraceToLogsDestinations', () => {
  const first = { customQuery: false, datasourceUid: 'loki1_uid' };
  const additional = { customQuery: true, datasourceUid: 'audit_uid', query: '{job="audit"}' };

  it.each([
    {
      name: 'places tracesToLogsV2 before the additional destinations',
      data: { tracesToLogsV2: first, tracesToLogsAdditional: [additional] },
      expected: [first, additional],
    },
    {
      name: 'keeps additional destinations without a first one',
      data: { tracesToLogsAdditional: [additional] },
      expected: [additional],
    },
    {
      name: 'ignores an additional block that is not a list',
      data: { tracesToLogsV2: first, tracesToLogsAdditional: 'bad' },
      expected: [first],
    },
    {
      name: 'ignores additional entries that are not objects',
      data: { tracesToLogsAdditional: [null, 42, additional] },
      expected: [additional],
    },
  ])('$name', ({ data, expected }) => {
    expect(getTraceToLogsDestinations(data as unknown as TraceToLogsData)).toEqual(expected);
  });
});

describe('getTraceToLogsOptions', () => {
  it('returns tracesToLogsV2 as-is without normalizing omitted customQuery', () => {
    const options = getTraceToLogsOptions({
      tracesToLogsV2: {
        datasourceUid: 'splunk1_uid',
        query: 'index=app $__span.traceId',
        filterByTraceID: true,
      } as TraceToLogsOptionsV2,
    });
    expect(options?.query).toBe('index=app $__span.traceId');
    expect(options?.customQuery).toBeUndefined();
  });
});
