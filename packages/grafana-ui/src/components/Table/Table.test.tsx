import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { applyFieldOverrides, createTheme, DataFrame, FieldType, toDataFrame } from '@grafana/data';

import { Table } from './Table';
import { Props } from './types';

function getDefaultDataFrame(): DataFrame {
  const dataFrame = toDataFrame({
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
  });
  const dataFrames = applyFieldOverrides({
    data: [dataFrame],
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    replaceVariables: (value, vars, format) => {
      return vars && value === '${__value.text}' ? vars['__value'].value.text : value;
    },
    timeZone: 'utc',
    theme: createTheme(),
  });
  return dataFrames[0];
}

function getTestContext(propOverrides: Partial<Props> = {}) {
  const onSortByChange = jest.fn();
  const onCellFilterAdded = jest.fn();
  const onColumnResize = jest.fn();
  const props: Props = {
    ariaLabel: 'aria-label',
    data: getDefaultDataFrame(),
    height: 600,
    width: 800,
    onSortByChange,
    onCellFilterAdded,
    onColumnResize,
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
  describe('when mounted without data', () => {
    it('then no data to show should be displayed', () => {
      getTestContext({ data: toDataFrame([]) });
      expect(getTable()).toBeInTheDocument();
      expect(screen.queryByRole('row')).not.toBeInTheDocument();
      expect(screen.getByText(/No data/i)).toBeInTheDocument();
    });
  });

  describe('when mounted with data', () => {
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
        { time: '2021-01-01 00:00:00', temperature: '10', link: '10' },
        { time: '2021-01-01 03:00:00', temperature: 'NaN', link: 'NaN' },
        { time: '2021-01-01 01:00:00', temperature: '11', link: '11' },
        { time: '2021-01-01 02:00:00', temperature: '12', link: '12' },
      ]);
    });
  });

  describe('when `showRowNums` is toggled', () => {
    const showRowNumsTestContext = {
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
    };

    it('should render the (fields.length) rows when `showRowNums` is untoggled', () => {
      getTestContext({ ...showRowNumsTestContext, showRowNums: false });

      expect(screen.getAllByRole('columnheader')).toHaveLength(1);
    });

    it('should render (fields.length + 1) rows row when `showRowNums` is toggled', () => {
      getTestContext({ ...showRowNumsTestContext, showRowNums: true });

      expect(screen.getAllByRole('columnheader')).toHaveLength(2);
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
        { time: '2021-01-01 02:00:00', temperature: '12', link: '12' },
        { time: '2021-01-01 01:00:00', temperature: '11', link: '11' },
        { time: '2021-01-01 00:00:00', temperature: '10', link: '10' },
        { time: '2021-01-01 03:00:00', temperature: 'NaN', link: 'NaN' },
      ]);
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

      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[0].textContent).toEqual('7');

      await userEvent.click(within(getColumnHeader(/number/)).getByRole('button', { name: '' }));
      await userEvent.click(screen.getByLabelText('1'));
      await userEvent.click(screen.getByText('Ok'));

      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[0].textContent).toEqual('3');
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
      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[0].textContent).toEqual('13');

      await userEvent.click(within(getColumnHeader(/number/)).getByRole('button', { name: '' }));
      await userEvent.click(screen.getByLabelText('2'));
      await userEvent.click(screen.getByLabelText('3'));
      await userEvent.click(screen.getByText('Ok'));

      //4 + header row
      expect(within(getTable()).getAllByRole('row')).toHaveLength(5);
      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[0].textContent).toEqual('10');
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
      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[0].textContent).toEqual('3');

      await userEvent.click(within(getColumnHeader(/number/)).getByRole('button', { name: '' }));
      await userEvent.click(screen.getByText('Clear filter'));

      //5 + header row
      expect(within(getTable()).getAllByRole('row')).toHaveLength(6);
      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[0].textContent).toEqual('7');
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
      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[0].textContent).toEqual('7');

      const onSortByChange = jest.fn();
      const onCellFilterAdded = jest.fn();
      const onColumnResize = jest.fn();
      const props: Props = {
        ariaLabel: 'aria-label',
        data: getDefaultDataFrame(),
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
      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[0].textContent).toEqual('5');
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

      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[0].textContent).toEqual('4');
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

      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[0].textContent).toEqual(
        'Count'
      );
      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[1].textContent).toEqual('5');
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

      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[0].textContent).toEqual(
        'Count'
      );
      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[1].textContent).toEqual('5');

      const onSortByChange = jest.fn();
      const onCellFilterAdded = jest.fn();
      const onColumnResize = jest.fn();
      const props: Props = {
        ariaLabel: 'aria-label',
        data: getDefaultDataFrame(),
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

      expect(within(getFooter()).getByRole('columnheader').getElementsByTagName('span')[0].textContent).toEqual('4');
    });
  });

  describe('when mounted with data and sub-data', () => {
    it('then correct rows should be rendered and new table is rendered when expander is clicked', async () => {
      getTestContext({
        subData: new Array(getDefaultDataFrame().length).fill(0).map((i) =>
          toDataFrame({
            name: 'A',
            fields: [
              {
                name: 'number' + i,
                type: FieldType.number,
                values: [i, i, i],
                config: {
                  custom: {
                    filterable: true,
                  },
                },
              },
            ],
            meta: {
              custom: {
                parentRowIndex: i,
              },
            },
          })
        ),
      });
      expect(getTable()).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader')).toHaveLength(4);
      expect(getColumnHeader(/time/)).toBeInTheDocument();
      expect(getColumnHeader(/temperature/)).toBeInTheDocument();
      expect(getColumnHeader(/img/)).toBeInTheDocument();

      const rows = within(getTable()).getAllByRole('row');
      expect(rows).toHaveLength(5);
      expect(getRowsData(rows)).toEqual([
        { time: '2021-01-01 00:00:00', temperature: '10', link: '10' },
        { time: '2021-01-01 03:00:00', temperature: 'NaN', link: 'NaN' },
        { time: '2021-01-01 01:00:00', temperature: '11', link: '11' },
        { time: '2021-01-01 02:00:00', temperature: '12', link: '12' },
      ]);

      await userEvent.click(within(rows[1]).getByLabelText('Expand row'));
      const rowsAfterClick = within(getTable()).getAllByRole('row');
      expect(within(rowsAfterClick[1]).getByRole('table')).toBeInTheDocument();
      expect(within(rowsAfterClick[1]).getByText(/number0/)).toBeInTheDocument();

      expect(within(rowsAfterClick[2]).queryByRole('table')).toBeNull();
    });
  });
});
