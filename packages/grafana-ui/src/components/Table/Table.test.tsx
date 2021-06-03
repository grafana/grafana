import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { applyFieldOverrides, createTheme, DataFrame, FieldType, toDataFrame } from '@grafana/data';
import { Props, Table } from './Table';

function getDefaultDataFrame(): DataFrame {
  const dataFrame = toDataFrame({
    name: 'A',
    fields: [
      {
        name: 'time',
        type: FieldType.time,
        values: [1609459200000, 1609462800000, 1609466400000],
        config: {
          custom: {
            filterable: false,
          },
        },
      },
      {
        name: 'temperature',
        type: FieldType.number,
        values: [10, 11, 12],
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
  return screen.getByRole('table');
}

function getColumnHeader(name: string | RegExp): HTMLElement {
  return within(getTable()).getByRole('columnheader', { name });
}

function getLinks(row: HTMLElement): HTMLElement[] {
  return within(row).getAllByRole('link');
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
      const rowOneLink = () => getLinks(rows[1])[0];
      const rowTwoLink = () => getLinks(rows[2])[0];
      const rowThreeLink = () => getLinks(rows[3])[0];

      expect(rows).toHaveLength(4);
      expect(within(rows[1]).getByText('2021-01-01 00:00:00')).toBeInTheDocument();
      expect(getLinks(rows[1])).toHaveLength(2);
      expect(within(rows[2]).getByText('2021-01-01 01:00:00')).toBeInTheDocument();
      expect(getLinks(rows[2])).toHaveLength(2);
      expect(within(rows[3]).getByText('2021-01-01 02:00:00')).toBeInTheDocument();
      expect(getLinks(rows[3])).toHaveLength(2);
      expect(rowOneLink()).toHaveTextContent('10');
      expect(rowOneLink()).toHaveAttribute('href', '10');
      expect(rowTwoLink()).toHaveTextContent('11');
      expect(rowTwoLink()).toHaveAttribute('href', '11');
      expect(rowThreeLink()).toHaveTextContent('12');
      expect(rowThreeLink()).toHaveAttribute('href', '12');
    });
  });

  describe('when sorting with column header', () => {
    it('then correct rows should be rendered', () => {
      getTestContext();

      userEvent.click(within(getColumnHeader(/temperature/)).getByText(/temperature/i));
      userEvent.click(within(getColumnHeader(/temperature/)).getByText(/temperature/i));

      const rows = within(getTable()).getAllByRole('row');
      expect(rows).toHaveLength(4);
      const rowOneLink = () => getLinks(rows[1])[0];
      const rowTwoLink = () => getLinks(rows[2])[0];
      const rowThreeLink = () => getLinks(rows[3])[0];

      expect(within(rows[1]).getByText('2021-01-01 02:00:00')).toBeInTheDocument();
      expect(rowOneLink()).toHaveTextContent('12');
      expect(rowOneLink()).toHaveAttribute('href', '12');
      expect(within(rows[2]).getByText('2021-01-01 01:00:00')).toBeInTheDocument();
      expect(rowTwoLink()).toHaveTextContent('11');
      expect(rowTwoLink()).toHaveAttribute('href', '11');
      expect(within(rows[3]).getByText('2021-01-01 00:00:00')).toBeInTheDocument();
      expect(rowThreeLink()).toHaveTextContent('10');
      expect(rowThreeLink()).toHaveAttribute('href', '10');
    });
  });
});
