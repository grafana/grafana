import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { applyFieldOverrides, createTheme, DataFrame, FieldType, toDataFrame } from '@grafana/data';

import { Icon } from '../Icon/Icon';

import { Table } from './TableRT/Table';
import { CustomHeaderRendererProps, TableRTProps } from './types';

// mock transition styles to ensure consistent behaviour in unit tests
jest.mock('@floating-ui/react', () => ({
  ...jest.requireActual('@floating-ui/react'),
  useTransitionStyles: () => ({
    styles: {},
  }),
}));

const dataFrameData = {
  name: 'A',
  fields: [
    {
      name: 'time',
      type: FieldType.time,
      values: [1609459200000, 1609470000000, 1609462800000, 1609466400000],
      config: {
        custom: {
          filterable: false,
        },
      },
    },
    {
      name: 'temperature',
      type: FieldType.number,
      values: [10, NaN, 11, 12],
      config: {
        custom: {
          filterable: false,
          headerComponent: (props: CustomHeaderRendererProps) => (
            <span>
              {props.defaultContent}
              <Icon aria-label={'header-icon'} name={'ellipsis-v'} />
            </span>
          ),
        },
        links: [
          {
            targetBlank: true,
            title: 'Value link',
            url: '${__value.text}',
          },
        ],
      },
    },
    {
      name: 'img',
      type: FieldType.string,
      values: ['data:image/png;base64,1', 'data:image/png;base64,2', 'data:image/png;base64,3'],
      config: {
        custom: {
          filterable: false,
          displayMode: 'image',
        },
        links: [
          {
            targetBlank: true,
            title: 'Image link',
            url: '${__value.text}',
          },
        ],
      },
    },
  ],
};

const fullDataFrame = toDataFrame(dataFrameData);

const emptyValuesDataFrame = toDataFrame({
  ...dataFrameData,
  // Remove all values
  fields: dataFrameData.fields.map((field) => ({ ...field, values: [] })),
});

function getDataFrame(dataFrame: DataFrame): DataFrame {
  return applyOverrides(dataFrame);
}

function applyOverrides(dataFrame: DataFrame) {
  const dataFrames = applyFieldOverrides({
    data: [dataFrame],
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    replaceVariables: (value, vars, _format) => {
      return vars && value === '${__value.text}' ? '${__value.text} interpolation' : value;
    },
    timeZone: 'utc',
    theme: createTheme(),
  });
  return dataFrames[0];
}

function getTestContext(propOverrides: Partial<TableRTProps> = {}) {
  const onSortByChange = jest.fn();
  const onCellFilterAdded = jest.fn();
  const onColumnResize = jest.fn();
  const props: TableRTProps = {
    ariaLabel: 'aria-label',
    data: getDataFrame(fullDataFrame),
    height: 600,
    width: 800,
    onSortByChange,
    onCellFilterAdded,
    onColumnResize,
    initialRowIndex: undefined,
  };

  Object.assign(props, propOverrides);
  const { rerender } = render(<Table {...props} />);

  return { rerender, onSortByChange, onCellFilterAdded, onColumnResize };
}

function getTable(): HTMLElement {
  return screen.getAllByRole('table')[0];
}

function getFooter(): HTMLElement {
  return screen.getByTestId('table-footer');
}

function getColumnHeader(name: string | RegExp): HTMLElement {
  return within(getTable()).getByRole('columnheader', { name });
}

function getLinks(row: HTMLElement): HTMLElement[] {
  return within(row).getAllByRole('link');
}

function getRowsData(rows: HTMLElement[]): Object[] {
  let content = [];
  for (let i = 1; i < rows.length; i++) {
    const row = getLinks(rows[i])[0];
    content.push({
      time: within(rows[i]).getByText(/2021*/).textContent,
      temperature: row.textContent,
      link: row.getAttribute('href'),
    });
  }
  return content;
}

describe('Table', () => {
  describe('when mounted with EMPTY data', () => {
    describe('and Standard Options `No value` value is NOT set', () => {
      it('the default `no data` message should be displayed', () => {
        getTestContext({ data: toDataFrame([]) });
        expect(getTable()).toBeInTheDocument();
        expect(screen.queryByRole('row')).not.toBeInTheDocument();
        expect(screen.getByText(/No data/i)).toBeInTheDocument();
      });
    });

    describe('and Standard Options `No value` value IS set', () => {
      it('the `No value` Standard Options message should be displayed', () => {
        const noValuesDisplayText = 'All healthy';
        getTestContext({
          data: toDataFrame([]),
          fieldConfig: { defaults: { noValue: noValuesDisplayText }, overrides: [] },
        });
        expect(getTable()).toBeInTheDocument();
        expect(screen.queryByRole('row')).not.toBeInTheDocument();
        expect(screen.getByText(noValuesDisplayText)).toBeInTheDocument();
      });
    });
  });

  describe('when mounted with data', () => {
    describe('but empty values', () => {
      describe('and Standard Options `No value` value is NOT set', () => {
        it('the default `no data` message should be displayed', () => {
          getTestContext({ data: getDataFrame(emptyValuesDataFrame) });
          expect(getTable()).toBeInTheDocument();
          expect(screen.getByText(/No data/i)).toBeInTheDocument();
        });
      });

      describe('and Standard Options `No value` value IS set', () => {
        it('the `No value` Standard Options message should be displayed', () => {
          const noValuesDisplayText = 'All healthy';
          getTestContext({
            data: getDataFrame(emptyValuesDataFrame),
            fieldConfig: { defaults: { noValue: noValuesDisplayText }, overrides: [] },
          });
          expect(getTable()).toBeInTheDocument();
          expect(screen.getByText(noValuesDisplayText)).toBeInTheDocument();
        });
      });
    });

    it('then correct rows should be rendered', () => {
      getTestContext();
      expect(getTable()).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader')).toHaveLength(3);
      expect(getColumnHeader(/time/)).toBeInTheDocument();
      expect(getColumnHeader(/temperature/)).toBeInTheDocument();
      expect(getColumnHeader(/img/)).toBeInTheDocument();

      const rows = within(getTable()).getAllByRole('row');
      expect(rows).toHaveLength(5);
      expect(getRowsData(rows)).toEqual([
        { time: '2021-01-01 00:00:00', temperature: '10', link: '${__value.text} interpolation' },
        { time: '2021-01-01 03:00:00', temperature: 'NaN', link: '${__value.text} interpolation' },
        { time: '2021-01-01 01:00:00', temperature: '11', link: '${__value.text} interpolation' },
        { time: '2021-01-01 02:00:00', temperature: '12', link: '${__value.text} interpolation' },
      ]);
    });
  });

  describe('when mounted with footer', () => {
    it('then footer should be displayed', () => {
      const footerValues = ['a', 'b', 'c'];
      getTestContext({ footerValues });
      expect(getTable()).toBeInTheDocument();
      expect(getFooter()).toBeInTheDocument();
    });
  });

  describe('when sorting with column header', () => {
    it('then correct rows should be rendered', async () => {
      getTestContext();

      await userEvent.click(within(getColumnHeader(/temperature/)).getByText(/temperature/i));
      await userEvent.click(within(getColumnHeader(/temperature/)).getByText(/temperature/i));

      const rows = within(getTable()).getAllByRole('row');
      expect(rows).toHaveLength(5);
      expect(getRowsData(rows)).toEqual([
        { time: '2021-01-01 02:00:00', temperature: '12', link: '${__value.text} interpolation' },
        { time: '2021-01-01 01:00:00', temperature: '11', link: '${__value.text} interpolation' },
        { time: '2021-01-01 00:00:00', temperature: '10', link: '${__value.text} interpolation' },
        { time: '2021-01-01 03:00:00', temperature: 'NaN', link: '${__value.text} interpolation' },
      ]);
    });
  });

  describe('custom header', () => {
    it('Should be rendered', async () => {
      getTestContext();

      await userEvent.click(within(getColumnHeader(/temperature/)).getByText(/temperature/i));
      await userEvent.click(within(getColumnHeader(/temperature/)).getByText(/temperature/i));

      const rows = within(getTable()).getAllByRole('row');
      expect(rows).toHaveLength(5);
      expect(within(rows[0]).getByLabelText('header-icon')).toBeInTheDocument();
    });
  });

  describe('on filtering', () => {
    it('the rows should be filtered', async () => {
      getTestContext({
        data: toDataFrame({
          name: 'A',
          fields: [
            {
              name: 'number',
              type: FieldType.number,
              values: [1, 1, 1, 2, 2, 3, 4, 5],
              config: {
                custom: {
                  filterable: true,
                },
              },
            },
          ],
        }),
      });

      expect(within(getTable()).getAllByRole('row')).toHaveLength(9);

      await userEvent.click(within(getColumnHeader(/number/)).getByRole('button', { name: '' }));
      await userEvent.click(screen.getByLabelText('1'));
      await userEvent.click(screen.getByText('Ok'));

      // 3 + header row
      expect(within(getTable()).getAllByRole('row')).toHaveLength(4);
    });

    it('should redo footer calculations', async () => {
      getTestContext({
        footerOptions: { show: true, reducer: ['sum'] },
        data: toDataFrame({
          name: 'A',
          fields: [
            {
              name: 'number',
              type: FieldType.number,
              values: [1, 1, 1, 2, 2],
              config: {
                custom: {
                  filterable: true,
                },
              },
            },
          ],
        }),
      });

      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[0]).toHaveTextContent('7');

      await userEvent.click(within(getColumnHeader(/number/)).getByRole('button', { name: '' }));
      await userEvent.click(screen.getByLabelText('1'));
      await userEvent.click(screen.getByText('Ok'));

      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[0]).toHaveTextContent('3');
    });

    it('should filter rows and recalculate footer values when multiple filter values are selected', async () => {
      getTestContext({
        footerOptions: { show: true, reducer: ['sum'] },
        data: toDataFrame({
          name: 'A',
          fields: [
            {
              name: 'number',
              type: FieldType.number,
              values: [1, 1, 1, 2, 2, 3, 3],
              config: {
                custom: {
                  filterable: true,
                },
              },
            },
          ],
        }),
      });

      expect(within(getTable()).getAllByRole('row')).toHaveLength(8);
      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[0]).toHaveTextContent('13');

      await userEvent.click(within(getColumnHeader(/number/)).getByRole('button', { name: '' }));
      await userEvent.click(screen.getByLabelText('2'));
      await userEvent.click(screen.getByLabelText('3'));
      await userEvent.click(screen.getByText('Ok'));

      //4 + header row
      expect(within(getTable()).getAllByRole('row')).toHaveLength(5);
      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[0]).toHaveTextContent('10');
    });

    it('should reset when clear filters button is pressed', async () => {
      getTestContext({
        footerOptions: { show: true, reducer: ['sum'] },
        data: toDataFrame({
          name: 'A',
          fields: [
            {
              name: 'number',
              type: FieldType.number,
              values: [1, 1, 1, 2, 2],
              config: {
                custom: {
                  filterable: true,
                },
              },
            },
          ],
        }),
      });

      await userEvent.click(within(getColumnHeader(/number/)).getByRole('button', { name: '' }));
      await userEvent.click(screen.getByLabelText('1'));
      await userEvent.click(screen.getByText('Ok'));

      //3 + header row
      expect(within(getTable()).getAllByRole('row')).toHaveLength(4);
      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[0]).toHaveTextContent('3');

      await userEvent.click(within(getColumnHeader(/number/)).getByRole('button', { name: '' }));
      await userEvent.click(screen.getByText('Clear filter'));

      //5 + header row
      expect(within(getTable()).getAllByRole('row')).toHaveLength(6);
      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[0]).toHaveTextContent('7');
    });
  });

  describe('on data change', () => {
    it('should redo footer value calculations', async () => {
      const { rerender } = getTestContext({
        footerOptions: { show: true, reducer: ['sum'] },
        data: toDataFrame({
          name: 'A',
          fields: [
            {
              name: 'number',
              type: FieldType.number,
              values: [1, 1, 1, 2, 2],
              config: {
                custom: {
                  filterable: true,
                },
              },
            },
          ],
        }),
      });

      //5 + header row
      expect(within(getTable()).getAllByRole('row')).toHaveLength(6);
      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[0]).toHaveTextContent('7');

      const onSortByChange = jest.fn();
      const onCellFilterAdded = jest.fn();
      const onColumnResize = jest.fn();
      const props: TableRTProps = {
        ariaLabel: 'aria-label',
        data: getDataFrame(fullDataFrame),
        height: 600,
        width: 800,
        onSortByChange,
        onCellFilterAdded,
        onColumnResize,
      };

      const propOverrides = {
        footerOptions: { show: true, reducer: ['sum'] },
        data: toDataFrame({
          name: 'A',
          fields: [
            {
              name: 'number',
              type: FieldType.number,
              values: [1, 1, 1, 2],
              config: {
                custom: {
                  filterable: true,
                },
              },
            },
          ],
        }),
      };

      Object.assign(props, propOverrides);

      rerender(<Table {...props} />);

      //4 + header row
      expect(within(getTable()).getAllByRole('row')).toHaveLength(5);
      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[0]).toHaveTextContent('5');
    });
  });

  describe('on table footer disabled', () => {
    it('should not show footer', async () => {
      getTestContext({
        footerOptions: { show: false, reducer: ['sum'] },
        data: toDataFrame({
          name: 'A',
          fields: [
            {
              name: 'number',
              type: FieldType.number,
              values: [1, 1, 1, 2, 2],
              config: {
                custom: {
                  filterable: true,
                },
              },
            },
          ],
        }),
      });

      expect(() => screen.getByTestId('table-footer')).toThrow('Unable to find an element');
    });
  });

  describe('on table footer enabled and count calculation selected', () => {
    it('should show count of non-null values', async () => {
      getTestContext({
        footerOptions: { show: true, reducer: ['count'] },
        data: toDataFrame({
          name: 'A',
          fields: [
            {
              name: 'number',
              type: FieldType.number,
              values: [1, 1, 1, 2, null],
              config: {
                custom: {
                  filterable: true,
                },
              },
            },
          ],
        }),
      });

      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[0]).toHaveTextContent('4');
    });

    it('should show count of rows when `count rows` is selected', async () => {
      getTestContext({
        footerOptions: { show: true, reducer: ['count'], countRows: true },
        data: toDataFrame({
          name: 'A',
          fields: [
            {
              name: 'number1',
              type: FieldType.number,
              values: [1, 1, 1, 2, null],
              config: {
                custom: {
                  filterable: true,
                },
              },
            },
          ],
        }),
      });

      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[0]).toHaveTextContent('Count');
      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[1]).toHaveTextContent('5');
    });

    it('should show correct counts when turning `count rows` on and off', async () => {
      const { rerender } = getTestContext({
        footerOptions: { show: true, reducer: ['count'], countRows: true },
        data: toDataFrame({
          name: 'A',
          fields: [
            {
              name: 'number1',
              type: FieldType.number,
              values: [1, 1, 1, 2, null],
              config: {
                custom: {
                  filterable: true,
                },
              },
            },
          ],
        }),
      });

      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[0]).toHaveTextContent('Count');
      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[1]).toHaveTextContent('5');

      const onSortByChange = jest.fn();
      const onCellFilterAdded = jest.fn();
      const onColumnResize = jest.fn();
      const props: TableRTProps = {
        ariaLabel: 'aria-label',
        data: getDataFrame(fullDataFrame),
        height: 600,
        width: 800,
        onSortByChange,
        onCellFilterAdded,
        onColumnResize,
      };

      const propOverrides = {
        footerOptions: { show: true, reducer: ['count'], countRows: false },
        data: toDataFrame({
          name: 'A',
          fields: [
            {
              name: 'number',
              type: FieldType.number,
              values: [1, 1, 1, 2, null],
              config: {
                custom: {
                  filterable: true,
                },
              },
            },
          ],
        }),
      };

      Object.assign(props, propOverrides);

      rerender(<Table {...props} />);

      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[0]).toHaveTextContent('4');
    });
  });

  describe('when mounted with nested data', () => {
    beforeEach(() => {
      const createNestedFrame = (idx: number) =>
        applyOverrides(
          toDataFrame({
            name: `nested_frame${idx}`,
            fields: [
              {
                name: `humidity_${idx}`,
                type: FieldType.string,
                values: [`3%_${idx}`, `17%_${idx}`],
              },
              {
                name: `status_${idx}`,
                type: FieldType.string,
                values: [`ok_${idx}`, `humid_${idx}`],
              },
            ],
          })
        );

      const defaultFrame = getDataFrame(fullDataFrame);

      getTestContext({
        data: applyOverrides({
          ...defaultFrame,
          fields: [
            ...defaultFrame.fields,
            {
              name: 'nested',
              type: FieldType.nestedFrames,
              values: [
                [createNestedFrame(0), createNestedFrame(1)],
                [createNestedFrame(2), createNestedFrame(3)],
              ],
              config: {},
            },
          ],
        }),
      });
    });

    it('then correct rows should be rendered and new table is rendered when expander is clicked', async () => {
      expect(getTable()).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader')).toHaveLength(4);
      expect(getColumnHeader(/time/)).toBeInTheDocument();
      expect(getColumnHeader(/temperature/)).toBeInTheDocument();
      expect(getColumnHeader(/img/)).toBeInTheDocument();

      const rows = within(getTable()).getAllByRole('row');
      expect(rows).toHaveLength(5);
      expect(getRowsData(rows)).toEqual([
        { time: '2021-01-01 00:00:00', temperature: '10', link: '${__value.text} interpolation' },
        { time: '2021-01-01 03:00:00', temperature: 'NaN', link: '${__value.text} interpolation' },
        { time: '2021-01-01 01:00:00', temperature: '11', link: '${__value.text} interpolation' },
        { time: '2021-01-01 02:00:00', temperature: '12', link: '${__value.text} interpolation' },
      ]);

      await userEvent.click(within(rows[1]).getByLabelText('Expand row'));
      expect(screen.getAllByRole('columnheader')).toHaveLength(8);
      expect(getColumnHeader(/humidity_0/)).toBeInTheDocument();
      expect(getColumnHeader(/humidity_1/)).toBeInTheDocument();
      expect(getColumnHeader(/status_0/)).toBeInTheDocument();
      expect(getColumnHeader(/status_1/)).toBeInTheDocument();

      const subTable0 = screen.getAllByRole('table')[1];
      const subTableRows0 = within(subTable0).getAllByRole('row');
      expect(subTableRows0).toHaveLength(3);
      expect(within(subTableRows0[1]).getByText(/3%_0/)).toBeInTheDocument();
      expect(within(subTableRows0[1]).getByText(/ok_0/)).toBeInTheDocument();
      expect(within(subTableRows0[2]).getByText(/17%_0/)).toBeInTheDocument();
      expect(within(subTableRows0[2]).getByText(/humid_0/)).toBeInTheDocument();

      const subTable1 = screen.getAllByRole('table')[2];
      const subTableRows1 = within(subTable1).getAllByRole('row');
      expect(subTableRows1).toHaveLength(3);
      expect(within(subTableRows1[1]).getByText(/3%_1/)).toBeInTheDocument();
      expect(within(subTableRows1[1]).getByText(/ok_1/)).toBeInTheDocument();
      expect(within(subTableRows1[2]).getByText(/17%_1/)).toBeInTheDocument();
      expect(within(subTableRows1[2]).getByText(/humid_1/)).toBeInTheDocument();
    });

    it('then properly handle row expansion and sorting', async () => {
      expect(getTable()).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader')).toHaveLength(4);
      expect(getColumnHeader(/time/)).toBeInTheDocument();
      expect(getColumnHeader(/temperature/)).toBeInTheDocument();
      expect(getColumnHeader(/img/)).toBeInTheDocument();

      let rows = within(getTable()).getAllByRole('row');
      expect(rows).toHaveLength(5);
      expect(getRowsData(rows)).toEqual([
        { time: '2021-01-01 00:00:00', temperature: '10', link: '${__value.text} interpolation' },
        { time: '2021-01-01 03:00:00', temperature: 'NaN', link: '${__value.text} interpolation' },
        { time: '2021-01-01 01:00:00', temperature: '11', link: '${__value.text} interpolation' },
        { time: '2021-01-01 02:00:00', temperature: '12', link: '${__value.text} interpolation' },
      ]);

      // Sort rows, and check the new order
      const table = getTable();
      await userEvent.click(within(table).getAllByTitle('Toggle SortBy')[0]);
      rows = within(table).getAllByRole('row');
      expect(rows).toHaveLength(5);
      expect(getRowsData(rows)).toEqual([
        { time: '2021-01-01 00:00:00', temperature: '10', link: '${__value.text} interpolation' },
        { time: '2021-01-01 01:00:00', temperature: '11', link: '${__value.text} interpolation' },
        { time: '2021-01-01 02:00:00', temperature: '12', link: '${__value.text} interpolation' },
        { time: '2021-01-01 03:00:00', temperature: 'NaN', link: '${__value.text} interpolation' },
      ]);

      // No sub table exists before expending a row
      let tables = screen.getAllByRole('table');
      expect(tables).toHaveLength(1);

      // Expand a row, and check its height
      rows = within(getTable()).getAllByRole('row');
      await userEvent.click(within(rows[1]).getByLabelText('Expand row'));
      tables = screen.getAllByRole('table');
      expect(tables).toHaveLength(3);
      let subTable = screen.getAllByRole('table')[2];
      expect(subTable).toHaveStyle({ height: '108px' });

      // Sort again rows
      tables = screen.getAllByRole('table');
      await userEvent.click(within(tables[0]).getAllByTitle('Toggle SortBy')[0]);
      rows = within(table).getAllByRole('row');
      expect(rows).toHaveLength(5);
      expect(getRowsData(rows)).toEqual([
        { time: '2021-01-01 03:00:00', temperature: 'NaN', link: '${__value.text} interpolation' },
        { time: '2021-01-01 02:00:00', temperature: '12', link: '${__value.text} interpolation' },
        { time: '2021-01-01 01:00:00', temperature: '11', link: '${__value.text} interpolation' },
        { time: '2021-01-01 00:00:00', temperature: '10', link: '${__value.text} interpolation' },
      ]);

      // Expand another row
      rows = within(getTable()).getAllByRole('row');
      await userEvent.click(within(rows[1]).getByLabelText('Expand row'));
      subTable = screen.getAllByRole('table')[2];
      expect(subTable).toHaveStyle({ height: '108px' });
    });
  });

  describe('when mounted with scrolled to specific row', () => {
    it('the row should be visible', async () => {
      getTestContext({
        initialRowIndex: 2,
      });
      expect(getTable()).toBeInTheDocument();

      const rows = within(getTable()).getAllByRole('row');
      expect(rows).toHaveLength(5);

      let selected = within(getTable()).getByRole('row', { selected: true });
      expect(selected).toBeVisible();
    });
  });
});
