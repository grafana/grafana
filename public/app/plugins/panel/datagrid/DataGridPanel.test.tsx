import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import * as React from 'react';

import { ArrayVector, DataFrame, dateTime, EventBus, Field, FieldType, LoadingState } from '@grafana/data';

import { DataGridPanel, DataGridProps } from './DataGridPanel';
import * as utils from './utils';

jest.mock('./featureFlagUtils', () => {
  return {
    isDatagridEnabled: jest.fn().mockReturnValue(true),
  };
});

jest.mock('./utils', () => {
  const originalModule = jest.requireActual('./utils');
  return {
    ...originalModule,
    deleteRows: jest.fn(),
    clearCellsFromRangeSelection: jest.fn(),
    updateSnapshot: jest.fn(),
  };
});

describe('DataGrid', () => {
  describe('when there is no data', () => {
    it('renders without error', () => {
      window.ResizeObserver = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      }));

      const props = buildPanelProps();

      render(<DataGridPanel {...props} />);

      expect(screen.getByText(/Unable to render data/i)).toBeInTheDocument();
    });
  });
  describe('when there is data', () => {
    let props: DataGridProps;

    beforeEach(() => {
      dataGridMocks();

      props = buildPanelProps({
        fields: [
          { name: 'A', type: FieldType.number, values: [1, 2, 3, 4], config: {} },
          { name: 'B', type: FieldType.string, values: ['a', 'b', 'c', 'd'], config: {} },
          { name: 'C', type: FieldType.string, values: ['a', 'b', 'c', 'd'], config: {} },
        ],
        length: 4,
      });
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.clearAllMocks();
    });

    it('converts dataframe values to cell values properly', () => {
      jest.useFakeTimers();
      render(<DataGridPanel {...props} />);
      prep(false);

      expect(screen.getByTestId('glide-cell-1-0')).toHaveTextContent('1');
      expect(screen.getByTestId('glide-cell-2-1')).toHaveTextContent('b');
      expect(screen.getByTestId('glide-cell-3-2')).toHaveTextContent('c');
      expect(screen.getByTestId('glide-cell-3-3')).toHaveTextContent('d');
    });

    it('should open context menu on right click', async () => {
      jest.useFakeTimers();
      render(<DataGridPanel {...props} />, {
        wrapper: Context,
      });
      const scroller = prep();

      if (!scroller) {
        return;
      }

      screen.getByTestId('data-grid-canvas');
      fireEvent.contextMenu(scroller, {
        clientX: 30,
        clientY: 36 + 32 + 16,
      });

      expect(screen.getByLabelText('Context menu')).toBeInTheDocument();

      // on right clicking row checkboxes, only row options should be open
      expect(screen.getByText('Delete row')).toBeInTheDocument();
      expect(screen.getByText('Clear row')).toBeInTheDocument();
      expect(screen.getByText('Remove all data')).toBeInTheDocument();
      expect(screen.getByText('Search...')).toBeInTheDocument();

      // no column options should be available at this point
      expect(screen.queryByText('Delete column')).not.toBeInTheDocument();

      // click on a column cell should show both row and column options
      fireEvent.contextMenu(scroller, {
        clientX: 50,
        clientY: 36 + 32 + 16,
      });

      expect(screen.getByText('Delete row')).toBeInTheDocument();
      expect(screen.getByText('Clear row')).toBeInTheDocument();
      expect(screen.getByText('Delete column')).toBeInTheDocument();
      expect(screen.getByText('Clear column')).toBeInTheDocument();
      expect(screen.getByText('Remove all data')).toBeInTheDocument();
      expect(screen.getByText('Search...')).toBeInTheDocument();

      // right clicking on header cell without clicking/selecting the cell should show only general options
      fireEvent.contextMenu(scroller, {
        clientX: 50,
        clientY: 36,
      });

      expect(screen.getByText('Remove all data')).toBeInTheDocument();
      expect(screen.getByText('Search...')).toBeInTheDocument();

      // selecting the header first and then right click on header cell should show only column options
      const canvas = screen.getByTestId('data-grid-canvas');
      sendClick(canvas, {
        clientX: 50,
        clientY: 36,
      });

      fireEvent.contextMenu(scroller, {
        clientX: 50,
        clientY: 36,
      });

      expect(screen.getByText('Delete column')).toBeInTheDocument();
      expect(screen.getByText('Remove all data')).toBeInTheDocument();
      expect(screen.getByText('Search...')).toBeInTheDocument();

      // no row options should be available at this point
      expect(screen.queryByText('Delete row')).not.toBeInTheDocument();
    });
    it('should show correct deletion values when selection multiple rows', async () => {
      jest.useFakeTimers();
      render(<DataGridPanel {...props} />, {
        wrapper: Context,
      });
      const scroller = prep();

      if (!scroller) {
        return;
      }

      const canvas = screen.getByTestId('data-grid-canvas');

      sendClick(canvas, {
        clientX: 30,
        clientY: 36 + 32 + 16,
        shiftKey: true,
      });

      sendClick(canvas, {
        clientX: 30,
        clientY: 36 + 32 + 16 + 30,
        shiftKey: true,
      });

      fireEvent.contextMenu(scroller, {
        clientX: 30,
        clientY: 36 + 32 + 16 + 30,
      });

      expect(screen.queryByText('Delete 2 rows')).toBeInTheDocument();
    });

    it('should show correct deletion values when selection multiple columns', async () => {
      jest.useFakeTimers();
      render(<DataGridPanel {...props} />, {
        wrapper: Context,
      });
      const scroller = prep();

      if (!scroller) {
        return;
      }

      const canvas = screen.getByTestId('data-grid-canvas');

      sendClick(canvas, {
        clientX: 40,
        clientY: 36,
        shiftKey: true,
      });

      sendClick(canvas, {
        clientX: 120,
        clientY: 36,
        shiftKey: true,
      });

      fireEvent.contextMenu(scroller, {
        clientX: 120,
        clientY: 36,
      });

      expect(screen.queryByText('Delete 2 columns')).toBeInTheDocument();
    });

    it('editing a cell triggers publishing the snapshot', async () => {
      const spy = jest.spyOn(utils, 'updateSnapshot');
      jest.useFakeTimers();
      render(<DataGridPanel {...props} />, {
        wrapper: Context,
      });
      prep();

      const canvas = screen.getByTestId('data-grid-canvas');
      //click on cell
      sendClick(canvas, {
        clientX: 50,
        clientY: 36 + 32 + 16,
      });

      //press key, this will open the overlay input and set it to the pressed key value
      fireEvent.keyDown(canvas, {
        keyCode: 74,
        key: '9',
      });

      const expectedField = {
        ...props.data.series[0].fields[0],
      };
      expectedField.values = [1, 9, 3, 4];

      await waitFor(() => {
        const overlay = screen.getByDisplayValue('9');

        // press enter to commit the value and close the overlay
        jest.useFakeTimers();
        fireEvent.keyDown(overlay, {
          key: 'Enter',
        });

        act(() => {
          jest.runAllTimers();
        });

        expect(spy).toHaveBeenCalledWith(
          expect.objectContaining({
            fields: expect.arrayContaining([expectedField]),
          }),
          undefined
        );
      });
    });

    it('should not be able to a edit cell when there is a grid selection', async () => {
      jest.useFakeTimers();
      render(<DataGridPanel {...props} />, {
        wrapper: Context,
      });
      prep();

      const canvas = screen.getByTestId('data-grid-canvas');
      //2 clicks with shift to select multiple cells
      sendClick(canvas, {
        clientX: 50,
        clientY: 36 + 32 + 16,
        shiftKey: true,
      });

      sendClick(canvas, {
        clientX: 120,
        clientY: 36 + 32 + 40,
        shiftKey: true,
      });

      // keydown to trigger overlay input on cell edit. since
      // there is a selection the overlay should not be visible
      fireEvent.keyDown(canvas, {
        keyCode: 74,
        key: '1',
      });

      await waitFor(() => {
        expect(screen.queryByDisplayValue('1')).not.toBeInTheDocument();
      });
    });
    it('should add a new column', async () => {
      const spy = jest.spyOn(utils, 'updateSnapshot');
      jest.useFakeTimers();
      render(<DataGridPanel {...props} />, {
        wrapper: Context,
      });
      prep();

      const addColumnBtn = screen.getByText('+');

      fireEvent.click(addColumnBtn);

      const columnInput = screen.getByTestId('column-input');

      fireEvent.change(columnInput, {
        target: { value: 'newColumn' },
      });

      fireEvent.blur(columnInput);

      expect(spy).toBeCalledWith(
        expect.objectContaining({
          fields: expect.arrayContaining([
            expect.objectContaining({
              name: 'newColumn',
              type: 'string',
              values: new ArrayVector(['', '', '', '']),
            }),
          ]),
        }),
        undefined
      );
    });

    it('should not add a new column if input is empty', async () => {
      const spy = jest.spyOn(utils, 'updateSnapshot');
      jest.useFakeTimers();
      render(<DataGridPanel {...props} />, {
        wrapper: Context,
      });
      prep();

      const addColumnBtn = screen.getByText('+');

      fireEvent.click(addColumnBtn);

      const columnInput = screen.getByTestId('column-input');

      fireEvent.blur(columnInput);

      expect(spy).not.toBeCalled();
    });

    it('should add a new row', async () => {
      const spy = jest.spyOn(utils, 'updateSnapshot');
      jest.useFakeTimers();
      render(<DataGridPanel {...props} />, {
        wrapper: Context,
      });
      prep();

      const canvas = screen.getByTestId('data-grid-canvas');

      sendClick(canvas, {
        clientX: 60,
        clientY: 36 + 32 * 5, //click add row
      });

      expect(spy).toBeCalled();
    });

    it('should close context menu on right click', async () => {
      jest.useFakeTimers();
      render(<DataGridPanel {...props} />, {
        wrapper: Context,
      });
      const scroller = prep();

      if (!scroller) {
        return;
      }

      const canvas = screen.getByTestId('data-grid-canvas');
      fireEvent.contextMenu(scroller, {
        clientX: 30,
        clientY: 36 + 32 + 16,
      });

      expect(screen.getByLabelText('Context menu')).toBeInTheDocument();

      sendClick(canvas, {
        clientX: 30,
        clientY: 36 + 32 + 16,
      });

      expect(screen.queryByLabelText('Context menu')).not.toBeInTheDocument();
    });

    it('should clear cell when cell is selected and delete button clicked', async () => {
      const spy = jest.spyOn(utils, 'updateSnapshot');
      const spyClearingCells = jest.spyOn(utils, 'clearCellsFromRangeSelection');
      const spyDeleteRows = jest.spyOn(utils, 'deleteRows');

      jest.useFakeTimers();
      render(<DataGridPanel {...props} />, {
        wrapper: Context,
      });
      const scroller = prep();

      if (!scroller) {
        return;
      }

      const canvas = screen.getByTestId('data-grid-canvas');
      sendClick(canvas, {
        clientX: 60,
        clientY: 36 + 32 + 16,
      });

      fireEvent.keyDown(canvas, {
        key: 'Delete',
      });

      expect(spy).toBeCalled();
      expect(spyClearingCells).toBeCalled();
      expect(spyDeleteRows).not.toBeCalled();
    });

    it('should clear row when row is selected delete button clicked', async () => {
      const spy = jest.spyOn(utils, 'updateSnapshot');
      const spyClearingCells = jest.spyOn(utils, 'clearCellsFromRangeSelection');
      const spyDeleteRows = jest.spyOn(utils, 'deleteRows');

      jest.useFakeTimers();
      render(<DataGridPanel {...props} />, {
        wrapper: Context,
      });
      prep();

      const canvas = screen.getByTestId('data-grid-canvas');
      sendClick(canvas, {
        clientX: 30,
        clientY: 36 + 32 + 16,
      });

      fireEvent.keyDown(canvas, {
        key: 'Delete',
      });

      expect(spy).toBeCalled();
      expect(spyClearingCells).not.toBeCalled();
      expect(spyDeleteRows).toBeCalled();
    });

    it('should move column when column dragged and dropped', async () => {
      const spy = jest.spyOn(utils, 'updateSnapshot');
      jest.useFakeTimers();
      render(<DataGridPanel {...props} />, {
        wrapper: Context,
      });
      prep();

      const canvas = screen.getByTestId('data-grid-canvas');

      fireEvent.mouseDown(canvas, {
        clientX: 50,
        clientY: 36,
      });

      fireEvent.mouseMove(canvas, {
        clientX: 120,
        clientY: 36,
      });

      fireEvent.mouseUp(canvas);

      const df = {
        ...props.data.series[0],
      };

      df.fields = [df.fields[1], df.fields[0], df.fields[2]];
      const received = spy.mock.calls[spy.mock.calls.length - 1][0].fields.map((f: Field) => f.name);

      expect(received).toEqual(df.fields.map((f) => f.name));
    });

    it('should move row when row dragged and dropped', async () => {
      const spy = jest.spyOn(utils, 'updateSnapshot');
      jest.useFakeTimers();
      render(<DataGridPanel {...props} />, {
        wrapper: Context,
      });
      prep();

      const canvas = screen.getByTestId('data-grid-canvas');

      fireEvent.mouseDown(canvas, {
        clientX: 30,
        clientY: 36 + 16,
      });

      fireEvent.mouseMove(canvas, {
        clientX: 30,
        clientY: 36 + 32 + 32 + 16,
      });

      fireEvent.mouseUp(canvas);

      const received: DataFrame = spy.mock.calls[spy.mock.calls.length - 1][0];

      expect(received.fields[0].values[0]).toEqual(2);
      expect(received.fields[0].values[1]).toEqual(3);
      expect(received.fields[0].values[2]).toEqual(1);
      expect(received.fields[0].values[3]).toEqual(4);

      expect(received.fields[1].values[0]).toEqual('b');
      expect(received.fields[1].values[1]).toEqual('c');
      expect(received.fields[1].values[2]).toEqual('a');
      expect(received.fields[1].values[3]).toEqual('d');

      expect(received.fields[2].values[0]).toEqual('b');
      expect(received.fields[2].values[1]).toEqual('c');
      expect(received.fields[2].values[2]).toEqual('a');
      expect(received.fields[2].values[3]).toEqual('d');
    });
  });
});

const buildPanelProps = (...df: DataFrame[]) => {
  const timeRange = {
    from: dateTime(),
    to: dateTime(),
    raw: {
      from: dateTime(),
      to: dateTime(),
    },
  };

  return {
    id: 1,
    title: 'DataGrid',
    options: { selectedSeries: 0 },
    data: {
      series: df,
      state: LoadingState.Done,
      timeRange,
    },
    timeRange,
    timeZone: 'browser',
    width: 500,
    height: 500,
    transparent: false,
    renderCounter: 0,
    onOptionsChange: jest.fn(),
    onFieldConfigChange: jest.fn(),
    onChangeTimeRange: jest.fn(),
    replaceVariables: jest.fn(),
    eventBus: {} as EventBus,
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
  };
};

const prep = (resetTimers = true) => {
  const scroller = document.getElementsByClassName('dvn-scroller').item(0);
  if (scroller !== null) {
    jest.spyOn(scroller, 'clientWidth', 'get').mockImplementation(() => 1000);
    jest.spyOn(scroller, 'clientHeight', 'get').mockImplementation(() => 1000);
  }

  act(() => {
    jest.runAllTimers();
  });
  if (resetTimers) {
    jest.useRealTimers();
  } else {
    act(() => {
      jest.runAllTimers();
    });
  }

  return scroller;
};

const dataGridMocks = () => {
  window.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));

  Element.prototype.scrollTo = jest.fn();
  Element.prototype.scrollBy = jest.fn();
  Element.prototype.getBoundingClientRect = () => ({
    bottom: 1000,
    height: 1000,
    left: 0,
    right: 1000,
    top: 0,
    width: 1000,
    x: 0,
    y: 0,
    toJSON: () => '',
  });
  Object.defineProperties(HTMLElement.prototype, {
    offsetWidth: {
      get() {
        return 1000;
      },
    },
  });
  Image.prototype.decode = jest.fn();
};

const sendClick = (el: Element | Node | Document | Window, options?: {}): void => {
  fireEvent.mouseDown(el, options);
  fireEvent.mouseUp(el, options);
  fireEvent.click(el, options);
};

const Context = (props: { children: React.ReactNode }) => {
  return (
    <>
      {props.children}
      <div id="grafana-portal-container"></div>
    </>
  );
};
