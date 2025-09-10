import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';

import {
  Field,
  LogLevel,
  LogRowModel,
  FieldType,
  createDataFrame,
  DataFrameType,
  PluginExtensionPoints,
  toDataFrame,
  LogsSortOrder,
  DataFrame,
  ScopedVars,
  getDefaultTimeRange,
} from '@grafana/data';
import { setPluginLinksHook } from '@grafana/runtime';
import { createTempoDatasource } from 'app/plugins/datasource/tempo/test/mocks';

import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';
import { createLogLine } from '../mocks/logRow';

import { LogLineDetails, Props } from './LogLineDetails';
import { LogListContext, LogListContextData } from './LogListContext';
import { defaultValue } from './__mocks__/LogListContext';

jest.mock('@grafana/assistant', () => {
  return {
    ...jest.requireActual('@grafana/assistant'),
    useAssistant: jest.fn().mockReturnValue([true, jest.fn()]),
  };
});

const tempoDS = createTempoDatasource();

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    usePluginLinks: jest.fn().mockReturnValue({ links: [] }),
    getDataSourceSrv: () => ({
      get: (uid: string) => Promise.resolve(tempoDS),
    }),
  };
});
jest.mock('./LogListContext');
jest.mock('app/features/explore/TraceView/TraceView', () => ({
  TraceView: () => <div>Trace view</div>,
}));

afterAll(() => {
  jest.unmock('app/features/explore/TraceView/TraceView');
});

const setup = (
  propOverrides?: Partial<Props>,
  rowOverrides?: Partial<LogRowModel>,
  contextOverrides?: Partial<LogListContextData>
) => {
  const logs = [createLogLine({ logLevel: LogLevel.error, timeEpochMs: 1546297200000, ...rowOverrides })];

  const props: Props = {
    containerElement: document.createElement('div'),
    focusLogLine: jest.fn(),
    logs,
    onResize: jest.fn(),
    timeRange: getDefaultTimeRange(),
    timeZone: 'browser',
    showControls: true,
    ...(propOverrides || {}),
  };

  const contextData: LogListContextData = {
    ...defaultValue,
    showDetails: logs,
    ...contextOverrides,
  };

  return render(
    <LogListContext.Provider value={contextData}>
      <LogLineDetails {...props} />
    </LogListContext.Provider>
  );
};

describe('LogLineDetails', () => {
  describe('when fields are present', () => {
    test('should render the fields and the log line', () => {
      setup(undefined, { labels: { key1: 'label1', key2: 'label2' } });
      expect(screen.getByText('Log line')).toBeInTheDocument();
      expect(screen.getByText('Fields')).toBeInTheDocument();
    });
    test('fields should be visible by default', () => {
      setup(undefined, { labels: { key1: 'label1', key2: 'label2' } });
      expect(screen.getByText('key1')).toBeInTheDocument();
      expect(screen.getByText('label1')).toBeInTheDocument();
      expect(screen.getByText('key2')).toBeInTheDocument();
      expect(screen.getByText('label2')).toBeInTheDocument();
    });
    test('should show an option to display the log line when displayed fields are used', async () => {
      const onClickShowField = jest.fn();

      setup(
        undefined,
        { labels: { key1: 'label1' } },
        { displayedFields: ['key1'], onClickShowField, onClickHideField: jest.fn() }
      );
      expect(screen.getByText('key1')).toBeInTheDocument();
      expect(screen.getByLabelText('Show log line')).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Show log line'));

      expect(onClickShowField).toHaveBeenCalledTimes(1);
    });
    test('should show an active option to display the log line when displayed fields are used', async () => {
      const onClickHideField = jest.fn();

      setup(
        undefined,
        { labels: { key1: 'label1' } },
        { displayedFields: ['key1', LOG_LINE_BODY_FIELD_NAME], onClickHideField, onClickShowField: jest.fn() }
      );
      expect(screen.getByText('key1')).toBeInTheDocument();
      expect(screen.getByLabelText('Hide log line')).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Hide log line'));

      expect(onClickHideField).toHaveBeenCalledTimes(1);
    });
    test('should not show an option to display the log line when displayed fields are not used', () => {
      setup(undefined, { labels: { key1: 'label1' } }, { displayedFields: [] });
      expect(screen.getByText('key1')).toBeInTheDocument();
      expect(screen.queryByLabelText('Show log line')).not.toBeInTheDocument();
    });
    test('should render the filter controls when the callbacks are provided', () => {
      setup(
        undefined,
        { labels: { key1: 'label1' } },
        {
          onClickFilterLabel: () => {},
          onClickFilterOutLabel: () => {},
        }
      );
      expect(screen.getByLabelText('Filter for value in query A')).toBeInTheDocument();
      expect(screen.getByLabelText('Filter out value in query A')).toBeInTheDocument();
    });
    describe('Toggleable filters', () => {
      test('should pass the log row to Explore filter functions', async () => {
        const onClickFilterLabelMock = jest.fn();
        const onClickFilterOutLabelMock = jest.fn();
        const isLabelFilterActiveMock = jest.fn().mockResolvedValue(true);
        const log = createLogLine({
          logLevel: LogLevel.error,
          timeEpochMs: 1546297200000,
          labels: { key1: 'label1' },
        });

        setup(
          {
            logs: [log],
          },
          undefined,
          {
            onClickFilterLabel: onClickFilterLabelMock,
            onClickFilterOutLabel: onClickFilterOutLabelMock,
            isLabelFilterActive: isLabelFilterActiveMock,
            showDetails: [log],
          }
        );

        expect(isLabelFilterActiveMock).toHaveBeenCalledWith('key1', 'label1', log.dataFrame.refId);

        await userEvent.click(screen.getByLabelText('Filter for value in query A'));
        expect(onClickFilterLabelMock).toHaveBeenCalledTimes(1);
        expect(onClickFilterLabelMock).toHaveBeenCalledWith(
          'key1',
          'label1',
          expect.objectContaining({
            fields: [
              expect.objectContaining({ values: [0] }),
              expect.objectContaining({ values: ['line1'] }),
              expect.objectContaining({ values: [{ app: 'app01' }] }),
            ],
            length: 1,
          })
        );

        await userEvent.click(screen.getByLabelText('Filter out value in query A'));
        expect(onClickFilterOutLabelMock).toHaveBeenCalledTimes(1);
        expect(onClickFilterOutLabelMock).toHaveBeenCalledWith(
          'key1',
          'label1',
          expect.objectContaining({
            fields: [
              expect.objectContaining({ values: [0] }),
              expect.objectContaining({ values: ['line1'] }),
              expect.objectContaining({ values: [{ app: 'app01' }] }),
            ],
            length: 1,
          })
        );
      });
    });
    test('should not render filter controls when the callbacks are not provided', () => {
      setup(
        undefined,
        { labels: { key1: 'label1' } },
        {
          onClickFilterLabel: undefined,
          onClickFilterOutLabel: undefined,
        }
      );
      expect(screen.queryByLabelText('Filter for value')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Filter out value')).not.toBeInTheDocument();
    });
  });
  describe('when the log has no fields to display', () => {
    test('should render no details available message', () => {
      setup(undefined, { entry: '' });
      expect(screen.getByText('No fields to display.')).toBeInTheDocument();
    });
    test('should not render headings', () => {
      setup(undefined, { entry: '' });
      expect(screen.queryByText('Fields')).not.toBeInTheDocument();
      expect(screen.queryByText('Links')).not.toBeInTheDocument();
      expect(screen.queryByText(/Indexed label/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Parsed field/)).not.toBeInTheDocument();
      expect(screen.queryByText('Structured metadata')).not.toBeInTheDocument();
    });
  });
  test('should render fields from the dataframe with links', async () => {
    const entry = 'traceId=1234 msg="some message"';
    const dataFrame = toDataFrame({
      fields: [
        { name: 'timestamp', config: {}, type: FieldType.time, values: [1] },
        { name: 'entry', values: [entry] },
        // As we have traceId in message already this will shadow it.
        {
          name: 'traceId',
          values: ['1234'],
          config: { links: [{ title: 'link title', url: 'localhost:3210/${__value.text}' }] },
        },
        { name: 'userId', values: ['5678'] },
      ],
    });
    const log = createLogLine(
      { entry, dataFrame, entryFieldIndex: 0, rowIndex: 0 },
      {
        escape: false,
        order: LogsSortOrder.Descending,
        timeZone: 'browser',
        virtualization: undefined,
        wrapLogMessage: true,
        getFieldLinks: (field: Field, rowIndex: number, dataFrame: DataFrame, vars: ScopedVars) => {
          if (field.config && field.config.links) {
            return field.config.links.map((link) => {
              return {
                href: link.url.replace('${__value.text}', field.values[rowIndex]),
                title: link.title,
                target: '_blank',
                origin: field,
              };
            });
          }
          return [];
        },
      }
    );

    setup({ logs: [log] }, undefined, { showDetails: [log] });

    expect(screen.getByText('Fields')).toBeInTheDocument();
    expect(screen.getByText('Links')).toBeInTheDocument();
    expect(screen.getByText('traceId')).toBeInTheDocument();
    expect(screen.getByText('link title')).toBeInTheDocument();
    expect(screen.queryByText('1234')).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Link value'));

    expect(screen.getByText('1234')).toBeInTheDocument();
  });

  test('should show the correct log details fields, links and labels for DataFrameType.LogLines frames', () => {
    const entry = 'test';
    const dataFrame = createDataFrame({
      fields: [
        { name: 'timestamp', config: {}, type: FieldType.time, values: [1] },
        { name: 'body', type: FieldType.string, values: [entry] },
        {
          name: 'labels',
          type: FieldType.other,
          values: [
            {
              label1: 'value1',
            },
          ],
        },
        {
          name: 'shouldNotShowFieldName',
          type: FieldType.string,
          values: ['shouldNotShowFieldValue'],
        },
        {
          name: 'shouldShowLinkName',
          type: FieldType.string,
          values: ['shouldShowLinkValue'],
          config: { links: [{ title: 'link', url: 'localhost:3210/${__value.text}' }] },
        },
      ],
      meta: {
        type: DataFrameType.LogLines,
      },
    });

    const log = createLogLine(
      { entry, dataFrame, entryFieldIndex: 0, rowIndex: 0, labels: { label1: 'value1' } },
      {
        escape: false,
        order: LogsSortOrder.Descending,
        timeZone: 'browser',
        virtualization: undefined,
        wrapLogMessage: true,
        getFieldLinks: (field: Field, rowIndex: number, dataFrame: DataFrame, vars: ScopedVars) => {
          if (field.config && field.config.links) {
            return field.config.links.map((link) => {
              return {
                href: link.url.replace('${__value.text}', field.values[rowIndex]),
                title: link.title,
                target: '_blank',
                origin: field,
              };
            });
          }
          return [];
        },
      }
    );

    setup({ logs: [log] }, undefined, { showDetails: [log] });

    expect(screen.getByText('Log line')).toBeInTheDocument();
    expect(screen.getByText('Fields')).toBeInTheDocument();
    expect(screen.getByText('Links')).toBeInTheDocument();

    // Don't show additional fields for DataFrameType.LogLines
    expect(screen.queryByText('shouldNotShowFieldName')).not.toBeInTheDocument();
    expect(screen.queryByText('shouldNotShowFieldValue')).not.toBeInTheDocument();

    // Show labels and links
    expect(screen.getByText('label1')).toBeInTheDocument();
    expect(screen.getByText('value1')).toBeInTheDocument();
    expect(screen.getByText('shouldShowLinkName')).toBeInTheDocument();
  });

  test('should load plugin links for logs view resource attributes extension point', () => {
    const usePluginLinksMock = jest.fn().mockReturnValue({ links: [] });
    setPluginLinksHook(usePluginLinksMock);
    jest.requireMock('@grafana/runtime').usePluginLinks = usePluginLinksMock;

    const rowOverrides = {
      datasourceType: 'loki',
      datasourceUid: 'grafanacloud-logs',
      labels: { key1: 'label1', key2: 'label2' },
    };
    setup(undefined, rowOverrides);

    expect(usePluginLinksMock).toHaveBeenCalledWith({
      extensionPointId: PluginExtensionPoints.LogsViewResourceAttributes,
      limitPerPlugin: 10,
      context: {
        datasource: {
          type: 'loki',
          uid: 'grafanacloud-logs',
        },
        attributes: { key1: ['label1'], key2: ['label2'] },
      },
    });
  });

  describe('Label types', () => {
    const entry = 'test';
    const labels = {
      label1: 'value1',
      label2: 'value2',
      label3: 'value3',
    };
    const dataFrame = createDataFrame({
      fields: [
        { name: 'timestamp', config: {}, type: FieldType.time, values: [1] },
        { name: 'body', type: FieldType.string, values: [entry] },
        { name: 'id', type: FieldType.string, values: ['1'] },
        {
          name: 'labels',
          type: FieldType.other,
          values: [labels],
        },
        {
          name: 'labelTypes',
          type: FieldType.other,
          values: [
            {
              label1: 'I',
              label2: 'S',
              label3: 'P',
            },
          ],
        },
      ],
      meta: {
        type: DataFrameType.LogLines,
      },
    });
    test('should show label types if they are available and supported', () => {
      setup(undefined, {
        entry,
        dataFrame,
        entryFieldIndex: 0,
        rowIndex: 0,
        labels,
        datasourceType: 'loki',
        rowId: '1',
      });

      // Show labels and links
      expect(screen.getByText('label1')).toBeInTheDocument();
      expect(screen.getByText('value1')).toBeInTheDocument();
      expect(screen.getByText('label2')).toBeInTheDocument();
      expect(screen.getByText('value2')).toBeInTheDocument();
      expect(screen.getByText('label3')).toBeInTheDocument();
      expect(screen.getByText('value3')).toBeInTheDocument();
      expect(screen.getByText(/Indexed label/)).toBeInTheDocument();
      expect(screen.getByText(/Parsed field/)).toBeInTheDocument();
      expect(screen.getByText('Structured metadata')).toBeInTheDocument();
    });
    test('should not show label types if they are unavailable or not supported', () => {
      setup(
        {},
        {
          entry,
          dataFrame,
          entryFieldIndex: 0,
          rowIndex: 0,
          labels,
          datasourceType: 'other datasource',
          rowId: '1',
        }
      );

      // Show labels and links
      expect(screen.getByText('label1')).toBeInTheDocument();
      expect(screen.getByText('value1')).toBeInTheDocument();
      expect(screen.getByText('label2')).toBeInTheDocument();
      expect(screen.getByText('value2')).toBeInTheDocument();
      expect(screen.getByText('label3')).toBeInTheDocument();
      expect(screen.getByText('value3')).toBeInTheDocument();

      expect(screen.getByText('Fields')).toBeInTheDocument();
      expect(screen.queryByText(/Indexed label/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Parsed field/)).not.toBeInTheDocument();
      expect(screen.queryByText('Structured metadata')).not.toBeInTheDocument();
    });

    test('Should allow to search within fields', async () => {
      setup(undefined, {
        entry,
        dataFrame,
        entryFieldIndex: 0,
        rowIndex: 0,
        labels,
        datasourceType: 'loki',
        rowId: '1',
      });

      expect(screen.getByText('label1')).toBeInTheDocument();
      expect(screen.getByText('value1')).toBeInTheDocument();
      expect(screen.getByText('label2')).toBeInTheDocument();
      expect(screen.getByText('value2')).toBeInTheDocument();
      expect(screen.getByText('label3')).toBeInTheDocument();
      expect(screen.getByText('value3')).toBeInTheDocument();

      const input = screen.getByPlaceholderText('Search field names and values');

      await userEvent.type(input, 'something else');

      expect(screen.getAllByText('No results to display.')).toHaveLength(3);
    });
  });

  describe('Label types', () => {
    test('Does not show displayed fields controls if not present', () => {
      setup(undefined, { labels: { key1: 'label1', key2: 'label2' } });
      expect(screen.queryByText('Displayed fields')).not.toBeInTheDocument();
    });

    test('Does not show displayed fields controls if required props are not present', () => {
      setup(undefined, { labels: { key1: 'label1', key2: 'label2' } }, { displayedFields: ['key1', 'key2'] });
      expect(screen.queryByText('Displayed fields')).not.toBeInTheDocument();
    });

    test('Shows displayed fields controls if required props are present', async () => {
      const setDisplayedFields = jest.fn();
      const onClickHideField = jest.fn();
      setup(
        undefined,
        { labels: { key1: 'label1', key2: 'label2' } },
        { displayedFields: ['key1', 'key2'], setDisplayedFields, onClickHideField }
      );

      expect(screen.getByText('Organize displayed fields')).toBeInTheDocument();
      expect(screen.queryAllByLabelText('Remove field')).toHaveLength(0);

      await userEvent.click(screen.getByText('Organize displayed fields'));

      expect(screen.getAllByLabelText('Remove field')).toHaveLength(2);

      await userEvent.click(screen.getAllByLabelText('Remove field')[0]);

      expect(onClickHideField).toHaveBeenCalledWith('key1');
    });

    test('Renders JSON field values', async () => {
      setup(
        undefined,
        { labels: { label1: 'value of label1', label2: '{"key1":"value1", "key2": "value2"}' } },
        { prettifyJSON: false }
      );

      expect(screen.getByText('label1')).toBeInTheDocument();
      expect(screen.getByText('value of label1')).toBeInTheDocument();
      expect(screen.getByText('label2')).toBeInTheDocument();
      expect(screen.getByText('{"key1":"value1", "key2": "value2"}')).toBeInTheDocument();
    });

    test('Renders prettify JSON field values', async () => {
      setup(
        undefined,
        { labels: { label1: 'value of label1', label2: '{"key1":"value1", "key2": "value2"}' } },
        { prettifyJSON: true }
      );

      expect(screen.getByText('label1')).toBeInTheDocument();
      expect(screen.getByText('value of label1')).toBeInTheDocument();
      expect(screen.getByText('label2')).toBeInTheDocument();
      expect(screen.queryByText('{"key1":"value1", "key2": "value2"}')).not.toBeInTheDocument();
      expect(screen.getByText(/key1/)).toBeInTheDocument();
      expect(screen.getByText(/value1/)).toBeInTheDocument();
      expect(screen.getByText(/key2/)).toBeInTheDocument();
      expect(screen.getByText(/value2/)).toBeInTheDocument();
    });

    test('Exposes buttons to reorder displayed fields', async () => {
      const setDisplayedFields = jest.fn();
      const onClickHideField = jest.fn();
      setup(
        undefined,
        { labels: { key1: 'label1', key2: 'label2' } },
        { displayedFields: ['key1', 'key2', 'key3'], setDisplayedFields, onClickHideField }
      );

      await userEvent.click(screen.getByText('Organize displayed fields'));

      expect(screen.getAllByLabelText('Remove field')).toHaveLength(3);
      expect(screen.getAllByLabelText('Move down')).toHaveLength(3);
      expect(screen.getAllByLabelText('Move up')).toHaveLength(3);

      await userEvent.click(screen.getAllByLabelText('Move down')[0]);

      expect(setDisplayedFields).toHaveBeenCalledWith(['key2', 'key1', 'key3']);

      await userEvent.click(screen.getAllByLabelText('Move up')[2]);

      expect(setDisplayedFields).toHaveBeenCalledWith(['key1', 'key3', 'key2']);
    });
  });

  describe('Multiple log details', () => {
    test('Does not render tabs when displaying a single log', () => {
      setup(undefined, { labels: { key1: 'label1', key2: 'label2' } });
      expect(screen.queryAllByRole('tab')).toHaveLength(0);
    });

    test('Renders multiple log details', async () => {
      const logs = [
        createLogLine({ uid: '1', logLevel: LogLevel.error, timeEpochMs: 1546297200000, entry: 'First log' }),
        createLogLine({ uid: '2', logLevel: LogLevel.error, timeEpochMs: 1546297200000, entry: 'Second log' }),
      ];
      setup({ logs }, undefined, { showDetails: logs });

      expect(screen.queryAllByRole('tab')).toHaveLength(2);

      await userEvent.click(screen.getByText('Log line'));

      expect(screen.getAllByText('First log')).toHaveLength(1);
      expect(screen.getAllByText('Second log')).toHaveLength(2);

      await userEvent.click(screen.queryAllByRole('tab')[0]);

      expect(screen.getAllByText('First log')).toHaveLength(2);
      expect(screen.getAllByText('Second log')).toHaveLength(1);
    });

    test('Changes details focus when logs are added and removed', async () => {
      const logs = [
        createLogLine({ uid: '1', logLevel: LogLevel.error, timeEpochMs: 1546297200000, entry: 'First log' }),
        createLogLine({ uid: '2', logLevel: LogLevel.error, timeEpochMs: 1546297200000, entry: 'Second log' }),
      ];

      const props: Props = {
        containerElement: document.createElement('div'),
        focusLogLine: jest.fn(),
        logs: [logs[0]],
        timeRange: getDefaultTimeRange(),
        timeZone: 'browser',
        showControls: true,
        onResize: jest.fn(),
      };

      const contextData: LogListContextData = {
        ...defaultValue,
        showDetails: [logs[0]],
      };

      const { rerender } = render(
        <LogListContext.Provider value={contextData}>
          <LogLineDetails {...props} />
        </LogListContext.Provider>
      );

      expect(screen.queryAllByRole('tab')).toHaveLength(0);

      await userEvent.click(screen.getByText('Log line'));
      // Tab not displayed, only line body
      expect(screen.getAllByText('First log')).toHaveLength(1);

      contextData.showDetails = logs;
      props.logs = logs;

      rerender(
        <LogListContext.Provider value={contextData}>
          <LogLineDetails {...props} />
        </LogListContext.Provider>
      );

      expect(screen.queryAllByRole('tab')).toHaveLength(2);
      // Tab and log line body
      expect(screen.getAllByText('Second log')).toHaveLength(2);

      contextData.showDetails = [logs[1]];
      props.logs = [logs[1]];

      rerender(
        <LogListContext.Provider value={contextData}>
          <LogLineDetails {...props} />
        </LogListContext.Provider>
      );

      expect(screen.queryAllByRole('tab')).toHaveLength(0);
      // Tab not displayed, only line body
      expect(screen.getAllByText('Second log')).toHaveLength(1);
    });
  });

  test('Requests and shows an embedded trace', async () => {
    const entry = 'traceId=1234 msg="some message"';
    const dataFrame = toDataFrame({
      fields: [
        { name: 'timestamp', config: {}, type: FieldType.time, values: [1] },
        { name: 'entry', values: [entry] },
        // As we have traceId in message already this will shadow it.
        {
          name: 'traceId',
          values: ['1234'],
          config: { links: [{ title: 'link title', url: 'localhost:3210/${__value.text}' }] },
        },
        { name: 'userId', values: ['5678'] },
      ],
    });
    const log = createLogLine(
      { entry, dataFrame, entryFieldIndex: 0, rowIndex: 0 },
      {
        escape: false,
        order: LogsSortOrder.Descending,
        timeZone: 'browser',
        virtualization: undefined,
        wrapLogMessage: true,
        getFieldLinks: (field: Field, rowIndex: number, dataFrame: DataFrame, vars: ScopedVars) => {
          if (field.config && field.config.links) {
            return field.config.links.map((link) => {
              return {
                href: '/explore',
                meta: {
                  internalLink: {
                    interpolated: {
                      query: {
                        query: 'abcd1234',
                        queryType: 'traceql'
                      }
                    }
                  }
                },
                title: 'tempo',
                target: '_blank',
                origin: field,
              };
            });
          }
          return [];
        },
      }
    );

    jest.spyOn(tempoDS, 'query').mockReturnValueOnce(
      of({
        data: [
          createDataFrame({
            fields: [
              { name: 'traceID', values: ['5d5d850e24d89509'], type: FieldType.string },
              { name: 'spanID', values: ['5d5d850e24d89509'], type: FieldType.string },
            ],
          }),
        ],
      })
    );

    setup({ logs: [log] }, undefined, { showDetails: [log] });

    expect(screen.getByText('Links')).toBeInTheDocument();
    expect(screen.getByText('Trace')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Trace'));

    expect(screen.getByText('Trace view')).toBeInTheDocument();
  });

  test('Shows a message if the trace cannot be retrieved', async () => {
    const entry = 'traceId=1234 msg="some message"';
    const dataFrame = toDataFrame({
      fields: [
        { name: 'timestamp', config: {}, type: FieldType.time, values: [1] },
        { name: 'entry', values: [entry] },
        // As we have traceId in message already this will shadow it.
        {
          name: 'traceId',
          values: ['1234'],
          config: { links: [{ title: 'link title', url: 'localhost:3210/${__value.text}' }] },
        },
        { name: 'userId', values: ['5678'] },
      ],
    });
    const log = createLogLine(
      { entry, dataFrame, entryFieldIndex: 0, rowIndex: 0 },
      {
        escape: false,
        order: LogsSortOrder.Descending,
        timeZone: 'browser',
        virtualization: undefined,
        wrapLogMessage: true,
        getFieldLinks: (field: Field, rowIndex: number, dataFrame: DataFrame, vars: ScopedVars) => {
          if (field.config && field.config.links) {
            return field.config.links.map((link) => {
              return {
                href: '/explore',
                meta: {
                  internalLink: {
                    interpolated: {
                      query: {
                        query: 'abcd1234',
                        queryType: 'traceql'
                      }
                    }
                  }
                },
                title: 'tempo',
                target: '_blank',
                origin: field,
              };
            });
          }
          return [];
        },
      }
    );

    jest.spyOn(tempoDS, 'query').mockReturnValueOnce(
      of({
        data: [],
      })
    );

    setup({ logs: [log] }, undefined, { showDetails: [log] });

    expect(screen.getByText('Links')).toBeInTheDocument();
    expect(screen.getByText('Trace')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Trace'));

    expect(screen.getByText('Could not retrieve trace.')).toBeInTheDocument();
  });

  test('shows attribute extension links when they are available', () => {
    const usePluginLinksMock = jest.fn().mockReturnValue({
      links: [
        {
          type: 'link',
          title: 'Open service overview for label',
          path: 'https://example.com',
          category: 'label',
          icon: 'compass',
        },
      ],
    });
    setPluginLinksHook(usePluginLinksMock);
    jest.requireMock('@grafana/runtime').usePluginLinks = usePluginLinksMock;

    setup(undefined, { labels: { label: 'value' } });

    expect(screen.getByText('label')).toBeInTheDocument();
    expect(screen.getByText('value')).toBeInTheDocument();
    expect(screen.getByText('Open service overview for label')).toBeInTheDocument();
  });
});
