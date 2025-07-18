import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  Field,
  LogLevel,
  LogRowModel,
  MutableDataFrame,
  createTheme,
  FieldType,
  createDataFrame,
  DataFrameType,
  CoreApp,
  PluginExtensionPoints,
} from '@grafana/data';
import { setPluginLinksHook } from '@grafana/runtime';

import { LogDetails, Props } from './LogDetails';
import { LOG_LINE_BODY_FIELD_NAME } from './LogDetailsBody';
import { getLogRowStyles } from './getLogRowStyles';
import { createLogRow } from './mocks/logRow';

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    usePluginLinks: jest.fn().mockReturnValue({ links: [] }),
  };
});

const setup = (propOverrides?: Partial<Props>, rowOverrides?: Partial<LogRowModel>) => {
  const theme = createTheme();
  const styles = getLogRowStyles(theme);
  const props: Props = {
    displayedFields: [],
    showDuplicates: false,
    wrapLogMessage: false,
    row: createLogRow({ logLevel: LogLevel.error, timeEpochMs: 1546297200000, ...rowOverrides }),
    getRows: () => [],
    onClickFilterLabel: () => {},
    onClickFilterOutLabel: () => {},
    onClickShowField: () => {},
    onClickHideField: () => {},
    theme,
    styles,
    app: CoreApp.Explore,
    ...(propOverrides || {}),
  };

  render(
    <table>
      <tbody>
        <LogDetails {...props} />
      </tbody>
    </table>
  );
};

describe('LogDetails', () => {
  describe('when labels are present', () => {
    it('should render heading', () => {
      setup(undefined, { labels: { key1: 'label1', key2: 'label2' } });
      expect(screen.getAllByLabelText('Fields')).toHaveLength(1);
    });
    it('should render labels', () => {
      setup(undefined, { labels: { key1: 'label1', key2: 'label2' } });
      expect(screen.getByRole('cell', { name: 'key1' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: 'label1' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: 'key2' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: 'label2' })).toBeInTheDocument();
    });
    it('should show an option to display the log line when displayed fields are used', async () => {
      const onClickShowField = jest.fn();

      setup({ displayedFields: ['key1'], onClickShowField }, { labels: { key1: 'label1' } });
      expect(screen.getByRole('cell', { name: 'key1' })).toBeInTheDocument();
      expect(screen.getByLabelText('Show log line')).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Show log line'));

      expect(onClickShowField).toHaveBeenCalledTimes(1);
    });
    it('should show an active option to display the log line when displayed fields are used', async () => {
      const onClickHideField = jest.fn();

      setup({ displayedFields: ['key1', LOG_LINE_BODY_FIELD_NAME], onClickHideField }, { labels: { key1: 'label1' } });
      expect(screen.getByRole('cell', { name: 'key1' })).toBeInTheDocument();
      expect(screen.getByLabelText('Hide log line')).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Hide log line'));

      expect(onClickHideField).toHaveBeenCalledTimes(1);
    });
    it('should not show an option to display the log line when displayed fields are not used', () => {
      setup({ displayedFields: undefined }, { labels: { key1: 'label1' } });
      expect(screen.getByRole('cell', { name: 'key1' })).toBeInTheDocument();
      expect(screen.queryByLabelText('Show log line')).not.toBeInTheDocument();
    });
    it('should render filter controls when the callbacks are provided', () => {
      setup(
        {
          onClickFilterLabel: () => {},
          onClickFilterOutLabel: () => {},
        },
        { labels: { key1: 'label1' } }
      );
      expect(screen.getByLabelText('Filter for value in query A')).toBeInTheDocument();
      expect(screen.getByLabelText('Filter out value in query A')).toBeInTheDocument();
    });
    describe('Toggleable filters', () => {
      it('should provide the log row to Explore filter functions', async () => {
        const onClickFilterLabelMock = jest.fn();
        const onClickFilterOutLabelMock = jest.fn();
        const isFilterLabelActiveMock = jest.fn().mockResolvedValue(true);
        const mockRow = createLogRow({
          logLevel: LogLevel.error,
          timeEpochMs: 1546297200000,
          labels: { key1: 'label1' },
        });

        setup({
          onClickFilterLabel: onClickFilterLabelMock,
          onClickFilterOutLabel: onClickFilterOutLabelMock,
          isFilterLabelActive: isFilterLabelActiveMock,
          row: mockRow,
        });

        expect(isFilterLabelActiveMock).toHaveBeenCalledWith('key1', 'label1', mockRow.dataFrame.refId);

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
    it('should not render filter controls when the callbacks are not provided', () => {
      setup(
        {
          onClickFilterLabel: undefined,
          onClickFilterOutLabel: undefined,
        },
        { labels: { key1: 'label1' } }
      );
      expect(screen.queryByLabelText('Filter for value')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Filter out value')).not.toBeInTheDocument();
    });
  });
  describe('when log row has error', () => {
    it('should not render log level border', () => {
      // Is this a good test case for RTL??
      setup({ hasError: true }, undefined);
      expect(screen.getByLabelText('Log level').classList.toString()).not.toContain('logs-row__level');
    });
  });
  describe('when row entry have parsable fields and labels are present', () => {
    it('should render all headings', () => {
      setup(undefined, { entry: 'test=successful', labels: { key: 'label' } });
      expect(screen.getAllByLabelText('Fields')).toHaveLength(1);
    });
    it('should render all labels and detected fields', () => {
      setup(undefined, { entry: 'test=successful', labels: { key: 'label' } });
      expect(screen.getByRole('cell', { name: 'key' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: 'label' })).toBeInTheDocument();
    });
  });
  describe('when row entry and labels are not present', () => {
    it('should render no details available message', () => {
      setup(undefined, { entry: '' });
      expect(screen.getByText('No details available')).toBeInTheDocument();
    });
    it('should not render headings', () => {
      setup(undefined, { entry: '' });
      expect(screen.queryAllByLabelText('Log labels')).toHaveLength(0);
      expect(screen.queryAllByLabelText('Detected fields')).toHaveLength(0);
    });
  });

  it('should render fields from dataframe with links', () => {
    const entry = 'traceId=1234 msg="some message"';
    const dataFrame = new MutableDataFrame({
      fields: [
        { name: 'timestamp', config: {}, type: FieldType.time, values: [1] },
        { name: 'entry', values: [entry] },
        // As we have traceId in message already this will shadow it.
        {
          name: 'traceId',
          values: ['1234'],
          config: { links: [{ title: 'link', url: 'localhost:3210/${__value.text}' }] },
        },
        { name: 'userId', values: ['5678'] },
      ],
    });
    setup(
      {
        getFieldLinks: (field: Field, rowIndex: number) => {
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
      },
      { entry, dataFrame, entryFieldIndex: 0, rowIndex: 0 }
    );
    expect(screen.getAllByRole('table')).toHaveLength(2);
    const rowDetailsTable = screen.getAllByRole('table')[1];
    const rowDetailRows = within(rowDetailsTable).getAllByRole('row');
    expect(rowDetailRows).toHaveLength(4); // 3 LogDetailsRow + 1 header
    const traceIdRow = within(rowDetailsTable).getByRole('cell', { name: 'traceId' }).closest('tr');
    expect(traceIdRow).toBeInTheDocument();
    const link = within(traceIdRow!).getByRole('link', { name: 'link' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'localhost:3210/1234');
  });

  it('should show correct log details fields, links and labels for DataFrameType.LogLines frames', () => {
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

    setup(
      {
        getFieldLinks: (field: Field, rowIndex: number) => {
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
      },
      { entry, dataFrame, entryFieldIndex: 0, rowIndex: 0, labels: { label1: 'value1' } }
    );

    // Don't show additional fields for DataFrameType.LogLines
    expect(screen.queryByText('shouldNotShowFieldName')).not.toBeInTheDocument();
    expect(screen.queryByText('shouldNotShowFieldValue')).not.toBeInTheDocument();

    // Show labels and links
    expect(screen.getByText('label1')).toBeInTheDocument();
    expect(screen.getByText('value1')).toBeInTheDocument();
    expect(screen.getByText('shouldShowLinkName')).toBeInTheDocument();
    expect(screen.getByText('shouldShowLinkValue')).toBeInTheDocument();
  });

  it('should load plugin links for logs view resource attributes extension point', () => {
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
    it('should show label types if they are available and supported', () => {
      setup(
        {},
        {
          entry,
          dataFrame,
          entryFieldIndex: 0,
          rowIndex: 0,
          labels,
          datasourceType: 'loki',
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
      expect(screen.getByText('I')).toBeInTheDocument();
      expect(screen.getByText('S')).toBeInTheDocument();
      expect(screen.getByText('P')).toBeInTheDocument();
    });
    it('should not show label types if they are unavailable or not supported', () => {
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
      expect(screen.queryByText('I')).not.toBeInTheDocument();
      expect(screen.queryByText('S')).not.toBeInTheDocument();
      expect(screen.queryByText('P')).not.toBeInTheDocument();
    });
  });
});
