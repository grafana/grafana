import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DataFrame, FieldType, store, toDataFrame } from '@grafana/data';
import { type FieldNameMetaStore } from 'app/features/explore/Logs/LogsTableWrap';

import { createLogLine } from '../mocks/logRow';
import { LogListContext, type LogListContextData } from '../panel/LogListContext';
import { defaultValue } from '../panel/__mocks__/LogListContext';
import { type LogListModel } from '../panel/processing';

import { FIELD_SELECTOR_MIN_WIDTH } from './FieldSelector';
import { LogListFieldSelector } from './LogListFieldSelector';
import { LogsTableFieldSelector } from './LogsTableFieldSelector';
import { LOG_LINE_BODY_FIELD_NAME } from './logFields';

const useBooleanFlagValueMock = jest.fn((_: string, defaultValue: boolean) => defaultValue);

const setBooleanFlags = (flags: Record<string, boolean>) => {
  useBooleanFlagValueMock.mockImplementation((flag: string, defaultValue: boolean) => {
    return Object.prototype.hasOwnProperty.call(flags, flag) ? flags[flag] : defaultValue;
  });
};

jest.mock('@openfeature/react-sdk', () => ({
  ...jest.requireActual('@openfeature/react-sdk'),
  useBooleanFlagValue: (flag: string, defaultValue: boolean) => useBooleanFlagValueMock(flag, defaultValue),
}));

let containerElement: HTMLDivElement;
let logs: LogListModel[];
let dataFrames: DataFrame[];

beforeEach(() => {
  setBooleanFlags({});
  containerElement = document.createElement('div');
  containerElement.style.height = '500px';
  containerElement.style.width = '1000px';

  logs = [
    createLogLine({ uid: '1', entry: 'log 1', labels: { service: 'frontend', level: 'info' } }),
    createLogLine({ uid: '2', entry: 'log 2', labels: { service: 'backend', level: 'error' } }),
  ];

  dataFrames = [
    toDataFrame({
      fields: [
        { name: 'timestamp', type: FieldType.time, values: [1, 2] },
        { name: 'body', type: FieldType.string, values: ['log 1', 'log 2'] },
        {
          name: 'labels',
          type: FieldType.other,
          values: [
            { service: 'frontend', level: 'info' },
            { service: 'backend', level: 'error' },
          ],
        },
      ],
    }),
  ];

  jest.spyOn(store, 'get').mockReturnValue('220');
});

describe('LogListFieldSelector', () => {
  const onClickShowField = jest.fn();
  const onClickHideField = jest.fn();
  const setDisplayedFields = jest.fn();

  const storageKey = 'test-storage-key';

  const defaultContextValue = {
    ...defaultValue,
    displayedFields: ['service'],
    onClickShowField,
    onClickHideField,
    setDisplayedFields,
    logOptionsStorageKey: storageKey,
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should render field selector when width is sufficient', () => {
    render(
      <LogListContext.Provider value={defaultContextValue}>
        <LogListFieldSelector containerElement={containerElement} logs={logs} dataFrames={dataFrames} />
      </LogListContext.Provider>
    );

    expect(screen.getByPlaceholderText('Search fields by name')).toBeInTheDocument();
  });

  test('should render collapsed button when width is too small', async () => {
    jest.spyOn(store, 'get').mockReturnValue(String(FIELD_SELECTOR_MIN_WIDTH));

    render(
      <LogListContext.Provider value={defaultContextValue}>
        <LogListFieldSelector containerElement={containerElement} logs={logs} dataFrames={dataFrames} />
      </LogListContext.Provider>
    );

    expect(screen.getByLabelText('Expand sidebar')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search fields by name')).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Expand sidebar'));

    expect(screen.getByPlaceholderText('Search fields by name')).toBeInTheDocument();
    expect(screen.queryByLabelText('Expand sidebar')).not.toBeInTheDocument();
  });

  test('should render with default width without a storage key', () => {
    render(
      <LogListContext.Provider value={{ ...defaultContextValue, logOptionsStorageKey: undefined }}>
        <LogListFieldSelector containerElement={containerElement} logs={logs} dataFrames={dataFrames} />
      </LogListContext.Provider>
    );

    expect(screen.getByPlaceholderText('Search fields by name')).toBeInTheDocument();
  });

  test('should call clear when reset button is clicked', async () => {
    render(
      <LogListContext.Provider value={defaultContextValue}>
        <LogListFieldSelector containerElement={containerElement} logs={logs} dataFrames={dataFrames} />
      </LogListContext.Provider>
    );

    const resetButton = screen.getByText('Reset');
    await userEvent.click(resetButton);

    expect(setDisplayedFields).toHaveBeenCalledWith([]);
  });

  test('should not render the selected fields without selected fields', () => {
    render(
      <LogListContext.Provider value={{ ...defaultContextValue, displayedFields: [] }}>
        <LogListFieldSelector containerElement={containerElement} logs={logs} dataFrames={dataFrames} />
      </LogListContext.Provider>
    );

    expect(screen.queryByText('Reset')).not.toBeInTheDocument();
    expect(screen.queryByText('Selected fields')).not.toBeInTheDocument();
  });

  test('should persist sidebar width to storage', async () => {
    const storeSpy = jest.spyOn(store, 'set');

    render(
      <LogListContext.Provider value={defaultContextValue}>
        <LogListFieldSelector containerElement={containerElement} logs={logs} dataFrames={dataFrames} />
      </LogListContext.Provider>
    );

    const collapseButton = screen.getByLabelText('Collapse sidebar');
    await userEvent.click(collapseButton);

    expect(storeSpy).toHaveBeenCalledWith(`${storageKey}.fieldSelector.width`, FIELD_SELECTOR_MIN_WIDTH);
  });

  test('should show selected fields and available fields', async () => {
    onClickHideField.mockClear();
    onClickShowField.mockClear();

    render(
      <LogListContext.Provider value={defaultContextValue}>
        <LogListFieldSelector containerElement={containerElement} logs={logs} dataFrames={dataFrames} />
      </LogListContext.Provider>
    );

    expect(screen.getByText('service')).toBeInTheDocument();
    expect(screen.getByText('level')).toBeInTheDocument();

    await userEvent.click(screen.getByText('service'));
    await userEvent.click(screen.getByText('level'));

    expect(onClickShowField).toHaveBeenCalledWith('level');
    expect(onClickHideField).toHaveBeenCalledWith('service');
  });

  test('should show suggested fields for any logging source when feature toggle is on', () => {
    setBooleanFlags({ otelLogsFormatting: true });

    const logsWithGenericFields: LogListModel[] = [
      createLogLine({
        uid: '1',
        entry: 'log 1',
        labels: { service_name: 'frontend', message: 'hello', app: 'web' },
      }),
      createLogLine({
        uid: '2',
        entry: 'log 2',
        labels: { service_name: 'backend', message: 'world' },
      }),
    ];

    const dataFramesWithGenericFields: DataFrame[] = [
      toDataFrame({
        fields: [
          { name: 'timestamp', type: FieldType.time, values: [1, 2] },
          { name: 'body', type: FieldType.string, values: ['log 1', 'log 2'] },
          {
            name: 'labels',
            type: FieldType.other,
            values: [
              { service_name: 'frontend', message: 'hello', app: 'web' },
              { service_name: 'backend', message: 'world' },
            ],
          },
        ],
      }),
    ];

    render(
      <LogListContext.Provider value={{ ...defaultContextValue, displayedFields: [] }}>
        <LogListFieldSelector
          containerElement={containerElement}
          logs={logsWithGenericFields}
          dataFrames={dataFramesWithGenericFields}
        />
      </LogListContext.Provider>
    );

    expect(screen.getByText('Suggested')).toBeInTheDocument();
    expect(screen.getAllByText('service_name').length).toBeGreaterThan(0);
    expect(screen.getAllByText('message').length).toBeGreaterThan(0);
    expect(screen.getAllByText('app').length).toBeGreaterThan(0);
  });
});

describe('LogListFieldSelector field values', () => {
  const onClickShowField = jest.fn();

  const contextValue = {
    ...defaultValue,
    displayedFields: [],
    onClickShowField,
    onClickHideField: jest.fn(),
    setDisplayedFields: jest.fn(),
  };

  const Selector = ({
    context = {},
    lines = logs,
  }: {
    context?: Partial<LogListContextData>;
    lines?: LogListModel[];
  }) => (
    <LogListContext.Provider value={{ ...contextValue, ...context }}>
      <LogListFieldSelector containerElement={containerElement} logs={lines} dataFrames={dataFrames} />
    </LogListContext.Provider>
  );

  const expandField = (name: RegExp) => userEvent.click(screen.getByRole('button', { name, expanded: false }));

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('does not make fields expandable when the feature toggle is off', async () => {
    render(<Selector />);

    expect(screen.queryByRole('button', { name: /level/, expanded: false })).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('level'));
    expect(onClickShowField).toHaveBeenCalledWith('level');
  });

  describe('with the feature toggle on', () => {
    beforeEach(() => {
      setBooleanFlags({ 'grafana.logsFieldSelectorValues': true });
    });

    test('expands a field from its row and toggles the field only from the checkbox', async () => {
      render(<Selector />);

      await expandField(/level/);

      expect(screen.getByRole('button', { name: /level/, expanded: true })).toBeInTheDocument();
      expect(screen.getByText('Top values in 2 loaded lines')).toBeInTheDocument();
      expect(screen.getByText('info').closest('li')).toHaveTextContent('50%');
      expect(onClickShowField).not.toHaveBeenCalled();

      await userEvent.click(screen.getByLabelText('Show level in log lines'));
      expect(onClickShowField).toHaveBeenCalledWith('level');
    });

    test('does not list empty values', async () => {
      const lines = [
        createLogLine({ uid: '1', labels: { service: '' } }),
        createLogLine({ uid: '2', labels: { service: 'backend' } }),
      ];
      render(<Selector lines={lines} />);

      await expandField(/service/);

      expect(screen.getAllByRole('listitem')).toHaveLength(1);
      expect(screen.getByRole('listitem')).toHaveTextContent('backend150%');
    });

    test('shows a message when no loaded line has a value', async () => {
      render(<Selector lines={[createLogLine({ uid: '1', labels: { service: '' } })]} />);

      await expandField(/service/);

      expect(screen.getByText('No values in the loaded lines')).toBeInTheDocument();
    });

    test('shows the ten most frequent values of a frame field', async () => {
      const lines = Array.from({ length: 12 }, (_, i) => {
        const line = createLogLine({ uid: String(i), labels: {} });
        line.dataFrame = {
          ...line.dataFrame,
          fields: [
            ...line.dataFrame.fields,
            { name: 'service', type: FieldType.string, config: {}, values: [`s${i}`] },
          ],
        };
        return line;
      });
      render(<Selector lines={lines} />);

      await expandField(/service/);

      expect(screen.getAllByRole('listitem')).toHaveLength(10);
      expect(screen.getByText('Top values in 12 loaded lines')).toBeInTheDocument();
    });

    test('keeps the drag handle on fields without values and moves it to the icon on expandable fields', () => {
      render(<Selector context={{ displayedFields: [LOG_LINE_BODY_FIELD_NAME, 'service'] }} />);

      const handles = screen.getAllByRole('button', { description: /Press space bar to start a drag/ });
      expect(handles).toHaveLength(2);
      expect(handles[0]).toHaveTextContent('Log line');
      expect(handles[1]).not.toHaveTextContent('service');
    });
  });
});

describe('LogsTableFieldSelector', () => {
  const clear = jest.fn();
  const reorder = jest.fn();
  const setSidebarWidth = jest.fn();
  const toggle = jest.fn();
  let columnsWithMeta: FieldNameMetaStore = {};

  beforeEach(() => {
    columnsWithMeta = {
      timestamp: { active: true, index: 0, type: 'TIME_FIELD', percentOfLinesWithLabel: 100 },
      body: { active: true, index: 1, type: 'BODY_FIELD', percentOfLinesWithLabel: 100 },
      service: { active: true, index: 2, percentOfLinesWithLabel: 50 },
      level: { active: false, index: undefined, percentOfLinesWithLabel: 50 },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should render field selector when width is sufficient', () => {
    render(
      <LogsTableFieldSelector
        columnsWithMeta={columnsWithMeta}
        clear={clear}
        dataFrames={dataFrames}
        reorder={reorder}
        setWidth={setSidebarWidth}
        width={300}
        toggle={toggle}
      />
    );

    expect(screen.getByPlaceholderText('Search fields by name')).toBeInTheDocument();
  });

  test('should render collapsed button when width is too small', async () => {
    const storeSpy = jest.spyOn(store, 'set');

    render(
      <LogsTableFieldSelector
        columnsWithMeta={columnsWithMeta}
        clear={clear}
        dataFrames={dataFrames}
        reorder={reorder}
        setWidth={setSidebarWidth}
        width={FIELD_SELECTOR_MIN_WIDTH}
        toggle={toggle}
      />
    );

    expect(screen.getByLabelText('Expand sidebar')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search fields by name')).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Expand sidebar'));

    expect(setSidebarWidth).toHaveBeenCalledWith(220);
    expect(storeSpy).toHaveBeenCalled();
  });

  test('should show selected fields and available fields', async () => {
    toggle.mockClear();

    render(
      <LogsTableFieldSelector
        columnsWithMeta={columnsWithMeta}
        clear={clear}
        dataFrames={dataFrames}
        reorder={reorder}
        setWidth={setSidebarWidth}
        width={300}
        toggle={toggle}
      />
    );

    expect(screen.getByText('Selected fields')).toBeInTheDocument();
    expect(screen.getByText('Reset')).toBeInTheDocument();
    expect(screen.getByText('timestamp')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
    expect(screen.getByText('service')).toBeInTheDocument();
    expect(screen.getByText('level')).toBeInTheDocument();

    await userEvent.click(screen.getByText('service'));
    await userEvent.click(screen.getByText('level'));

    expect(toggle).toHaveBeenCalledWith('service');
    expect(toggle).toHaveBeenCalledWith('level');
  });

  test('should call clear when reset button is clicked', async () => {
    render(
      <LogsTableFieldSelector
        columnsWithMeta={columnsWithMeta}
        clear={clear}
        dataFrames={dataFrames}
        reorder={reorder}
        setWidth={setSidebarWidth}
        width={300}
        toggle={toggle}
      />
    );

    await userEvent.click(screen.getByText('Reset'));

    expect(clear).toHaveBeenCalled();
  });

  test('should persist sidebar width to storage when collapsing', async () => {
    const storeSpy = jest.spyOn(store, 'set');

    render(
      <LogsTableFieldSelector
        columnsWithMeta={columnsWithMeta}
        clear={clear}
        dataFrames={dataFrames}
        reorder={reorder}
        setWidth={setSidebarWidth}
        width={300}
        toggle={toggle}
      />
    );

    await userEvent.click(screen.getByLabelText('Collapse sidebar'));

    expect(setSidebarWidth).toHaveBeenCalledWith(FIELD_SELECTOR_MIN_WIDTH);
    expect(storeSpy).toHaveBeenCalled();
  });
});
