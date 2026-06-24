import { render, screen } from '@testing-library/react';

import { type DataFrame, FieldType, getDefaultTimeRange, InternalTimeZones, toDataFrame } from '@grafana/data';

import { TableContainer } from './TableContainer';

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
  queryStreaming: false,
  width: 800,
  onCellFilterAdded: jest.fn(),
  tableResult: [dataFrame],
  splitOpenFn: () => {},
  range: getDefaultTimeRange(),
  timeZone: InternalTimeZones.utc,
};

describe('TableContainer', () => {
  describe('With one main frame', () => {
    it('should render component', () => {
      render(<TableContainer {...defaultProps} />);
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
      render(<TableContainer {...defaultProps} tableResult={emptyFrames} />);
      expect(screen.getByText('0 series returned')).toBeInTheDocument();
    });

    it('should render table title with Prometheus query', () => {
      const dataFrames = [{ ...dataFrame, name: 'metric{label="value"}' }];
      const tableProps = { ...defaultProps, tableResult: dataFrames };
      render(<TableContainer {...tableProps} />);
      expect(screen.getByText('Table - metric{label="value"}')).toBeInTheDocument();
    });

    it('preserves datasource hidden fields while applying Explore column limiting', () => {
      const df = toDataFrame({
        name: 'A',
        fields: [
          {
            name: 'traceIdHidden',
            type: FieldType.string,
            values: ['t1'],
            config: {
              custom: {
                hideFrom: { viz: true },
              },
            },
          },

          {
            name: 'spanId',
            type: FieldType.string,
            values: ['s1'],
            config: {},
          },
        ],
      });

      render(<TableContainer {...defaultProps} tableResult={[df]} />);
      expect(df.fields[0].config.custom?.hideFrom?.viz).toBe(true);
      expect(df.fields[1].config.custom?.hideFrom?.viz).toBe(false);
    });
  });

  describe('With multiple main frames', () => {
    it('should render multiple tables for multiple frames', () => {
      const dataFrames = [dataFrame, dataFrame];
      const multiDefaultProps = { ...defaultProps, tableResult: dataFrames };
      render(<TableContainer {...multiDefaultProps} />);
      const tables = getPanels();
      expect(tables.length).toBe(2);
      expect(tables[0]).toBeInTheDocument();
      expect(tables[1]).toBeInTheDocument();
    });
  });
});
