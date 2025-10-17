import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataFrame, FieldType, store, toDataFrame } from '@grafana/data';
import { FieldNameMetaStore } from 'app/features/explore/Logs/LogsTableWrap';

import { createLogLine } from '../../mocks/logRow';
import { LogListContext } from '../LogListContext';
import { defaultValue } from '../__mocks__/LogListContext';
import { LogListModel } from '../processing';

import { LogListFieldSelector, LogsTableFieldSelector, MIN_WIDTH } from './FieldSelector';

let containerElement: HTMLDivElement;
let logs: LogListModel[];
let dataFrames: DataFrame[];

beforeEach(() => {
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
    jest.spyOn(store, 'get').mockReturnValue(String(MIN_WIDTH));

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

    expect(storeSpy).toHaveBeenCalledWith(`${storageKey}.fieldSelector.width`, MIN_WIDTH);
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
        logs={logs}
        reorder={reorder}
        setSidebarWidth={setSidebarWidth}
        sidebarWidth={300}
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
        logs={logs}
        reorder={reorder}
        setSidebarWidth={setSidebarWidth}
        sidebarWidth={MIN_WIDTH}
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
        logs={logs}
        reorder={reorder}
        setSidebarWidth={setSidebarWidth}
        sidebarWidth={300}
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
        logs={logs}
        reorder={reorder}
        setSidebarWidth={setSidebarWidth}
        sidebarWidth={300}
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
        logs={logs}
        reorder={reorder}
        setSidebarWidth={setSidebarWidth}
        sidebarWidth={300}
        toggle={toggle}
      />
    );

    await userEvent.click(screen.getByLabelText('Collapse sidebar'));

    expect(setSidebarWidth).toHaveBeenCalledWith(MIN_WIDTH);
    expect(storeSpy).toHaveBeenCalled();
  });
});
