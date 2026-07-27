import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DataFrame, FieldType, getDefaultTimeRange, InternalTimeZones, toDataFrame } from '@grafana/data';
import { setPanelRenderer } from '@grafana/runtime/internal';

import { TableContainer } from './TableContainer';

const mockRenderedSeries: DataFrame[][] = [];

setPanelRenderer((props) => {
  mockRenderedSeries.push(props.data?.series ?? []);
  return <div>PanelRenderer</div>;
});

function getPanels(): HTMLElement[] {
  return screen.getAllByText(/PanelRenderer/);
}

function getLastRenderedFrame(): DataFrame {
  return mockRenderedSeries[mockRenderedSeries.length - 1][0];
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
  beforeEach(() => {
    mockRenderedSeries.length = 0;
  });

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

      const rendered = getLastRenderedFrame();
      expect(rendered.fields[0].config.custom?.hideFrom?.viz).toBe(true);
      expect(rendered.fields[1].config.custom?.hideFrom?.viz).toBe(false);
    });

    it('does not mutate the frames from state when limiting columns', () => {
      const df = toDataFrame({
        name: 'A',
        fields: Array.from({ length: 25 }, (_, i) => ({
          name: `field${i}`,
          type: FieldType.number,
          values: [i],
          config: {},
        })),
      });
      const configsBefore = df.fields.map((field) => field.config);

      render(<TableContainer {...defaultProps} tableResult={[df]} />);

      // limiting is applied to the rendered copy...
      const rendered = getLastRenderedFrame();
      expect(rendered.fields[19].config.custom?.hideFrom?.viz).toBe(false);
      expect(rendered.fields[20].config.custom?.hideFrom?.viz).toBe(true);
      expect(rendered.fields[24].config.custom?.hideFrom?.viz).toBe(true);

      // ...but the frame from state is untouched, as its field configs can be shared
      // by reference with other visualizations (e.g. the Explore graph)
      df.fields.forEach((field, i) => {
        expect(field.config).toBe(configsBefore[i]);
        expect(field.config.custom?.hideFrom).toBeUndefined();
        expect(field.config.custom?.hidden).toBeUndefined();
      });
    });

    it('shows all columns after clicking "Show all columns"', async () => {
      const df = toDataFrame({
        name: 'A',
        fields: Array.from({ length: 25 }, (_, i) => ({
          name: `field${i}`,
          type: FieldType.number,
          values: [i],
          config: {},
        })),
      });

      render(<TableContainer {...defaultProps} tableResult={[df]} />);
      expect(getLastRenderedFrame().fields[24].config.custom?.hideFrom?.viz).toBe(true);

      await userEvent.click(screen.getByText('Show all columns'));

      const rendered = getLastRenderedFrame();
      rendered.fields.forEach((field) => {
        expect(field.config.custom?.hideFrom?.viz).toBe(false);
      });
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
