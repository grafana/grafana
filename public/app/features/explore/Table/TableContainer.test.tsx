import { render, screen } from '@testing-library/react';

import { DataFrame, FieldType, getDefaultTimeRange, InternalTimeZones, toDataFrame } from '@grafana/data';

import { TableContainerWithTheme } from './TableContainer';

function getPanels(): HTMLElement[] {
  return screen.getAllByText(/PanelRenderer/);
}

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
      name: 'text',
      type: FieldType.string,
      values: ['test_string_1', 'test_string_2', 'test_string_3', 'test_string_4'],
      config: {
        custom: {
          filterable: false,
        },
      },
    },
  ],
});

const defaultProps = {
  exploreId: 'left',
  loading: false,
  width: 800,
  onCellFilterAdded: jest.fn(),
  tableResult: [dataFrame],
  splitOpenFn: () => {},
  range: getDefaultTimeRange(),
  timeZone: InternalTimeZones.utc,
};

describe('TableContainerWithTheme', () => {
  describe('With one main frame', () => {
    it('should render component', () => {
      render(<TableContainerWithTheme {...defaultProps} />);
      const tables = getPanels();
      expect(tables.length).toBe(1);
      expect(tables[0]).toBeInTheDocument();
    });

    it('should render 0 series returned on no items', () => {
      const emptyFrames: DataFrame[] = [
        {
          name: 'TableResultName',
          fields: [],
          length: 0,
        },
      ];
      render(<TableContainerWithTheme {...defaultProps} tableResult={emptyFrames} />);
      expect(screen.getByText('0 series returned')).toBeInTheDocument();
    });

    it('should render table title with Prometheus query', () => {
      const dataFrames = [{ ...dataFrame, name: 'metric{label="value"}' }];
      const tableProps = { ...defaultProps, tableResult: dataFrames };
      render(<TableContainerWithTheme {...tableProps} />);
      expect(screen.getByText('Table - metric{label="value"}')).toBeInTheDocument();
    });
  });

  describe('With multiple main frames', () => {
    it('should render multiple tables for multiple frames', () => {
      const dataFrames = [dataFrame, dataFrame];
      const multiDefaultProps = { ...defaultProps, tableResult: dataFrames };
      render(<TableContainerWithTheme {...multiDefaultProps} />);
      const tables = getPanels();
      expect(tables.length).toBe(2);
      expect(tables[0]).toBeInTheDocument();
      expect(tables[1]).toBeInTheDocument();
    });
  });
});
