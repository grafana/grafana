import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FieldType, FormattedValue, toDataFrame } from '@grafana/data';

import { RawPrometheusContainerPure, RawPrometheusContainerPureProps } from './RawPrometheusContainerPure';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    theme: { panelPadding: 8 },
  },
  reportInteraction: jest.fn(),
}));

const display = (input: string | number): FormattedValue => ({
  text: String(input),
});

const dataFrame = toDataFrame({
  name: 'A',
  fields: [
    {
      name: '__name__',
      type: FieldType.string,
      values: ['up', 'up', 'up'],
      config: {},
      display,
    },
    {
      name: 'instance',
      type: FieldType.string,
      values: ['localhost:9090', 'localhost:9091', 'localhost:9092'],
      config: {},
      display,
    },
    {
      name: 'Value',
      type: FieldType.number,
      values: [1, 1, 0],
      config: {},
      display,
    },
  ],
});

const emptyFrame = toDataFrame({
  name: 'Empty',
  fields: [
    { name: '__name__', type: FieldType.string, values: [], config: {}, display },
    { name: 'Value', type: FieldType.number, values: [], config: {}, display },
  ],
});

const defaultProps: RawPrometheusContainerPureProps = {
  tableResult: [dataFrame],
  width: 800,
};

describe('RawPrometheusContainerPure', () => {
  describe('empty states', () => {
    it('shows "0 series returned" when no frames', () => {
      render(<RawPrometheusContainerPure {...defaultProps} tableResult={[]} />);
      expect(screen.getByText('0 series returned')).toBeInTheDocument();
    });

    it('shows "0 series returned" when frames are empty', () => {
      render(<RawPrometheusContainerPure {...defaultProps} tableResult={[emptyFrame]} />);
      expect(screen.getByText('0 series returned')).toBeInTheDocument();
    });
  });

  describe('table/raw toggle', () => {
    it('renders table only (no toggle) when showRawPrometheus is undefined', () => {
      render(<RawPrometheusContainerPure {...defaultProps} showRawPrometheus={undefined} />);

      // Should have table rendered
      expect(screen.getByRole('table')).toBeInTheDocument();

      // Should not have toggle buttons
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    });

    it('renders toggle when showRawPrometheus is true', () => {
      render(<RawPrometheusContainerPure {...defaultProps} showRawPrometheus={true} />);

      // Should have toggle buttons
      const radioButtons = screen.getAllByRole('radio');
      expect(radioButtons.length).toBeGreaterThan(0);
    });

    it('can toggle between table and raw views', async () => {
      const user = userEvent.setup();
      render(<RawPrometheusContainerPure {...defaultProps} showRawPrometheus={true} />);

      // Initially in raw view (showRawPrometheus=true starts in raw mode)
      const tableButton = screen.getByRole('radio', { name: 'Table' });
      const rawButton = screen.getByRole('radio', { name: 'Raw' });

      // Raw should be selected initially
      expect(rawButton).toBeChecked();
      expect(tableButton).not.toBeChecked();

      // Click table button to switch to table view
      await user.click(tableButton);

      expect(tableButton).toBeChecked();
      expect(rawButton).not.toBeChecked();
    });
  });

  describe('with data', () => {
    it('renders table with data', () => {
      render(<RawPrometheusContainerPure {...defaultProps} />);

      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('filters out empty frames', () => {
      render(<RawPrometheusContainerPure {...defaultProps} tableResult={[emptyFrame, dataFrame]} />);

      // Should render table with data (empty frame filtered out)
      expect(screen.getByRole('table')).toBeInTheDocument();
      // Should not show "0 series returned"
      expect(screen.queryByText('0 series returned')).not.toBeInTheDocument();
    });
  });
});
