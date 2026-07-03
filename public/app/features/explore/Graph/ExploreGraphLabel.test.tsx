import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ExploreGraphLabel } from './ExploreGraphLabel';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  UnitPicker: ({ value, onChange }: { value?: string; onChange: (unit: string | undefined) => void }) => (
    <button data-testid="unit-picker" onClick={() => onChange('bytes')}>
      {value ?? 'Unit'}
    </button>
  ),
  RadioButtonGroup: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <button data-testid="graph-style-picker" onClick={() => onChange('lines')}>
      {value}
    </button>
  ),
}));

describe('ExploreGraphLabel', () => {
  const defaultProps = {
    graphStyle: 'lines' as const,
    onChangeGraphStyle: jest.fn(),
    onChangeUnit: jest.fn(),
  };

  it('renders unit picker and graph style picker', () => {
    render(<ExploreGraphLabel {...defaultProps} />);
    expect(screen.getByTestId('unit-picker')).toBeInTheDocument();
    expect(screen.getByTestId('graph-style-picker')).toBeInTheDocument();
  });

  it('shows the selected unit value', () => {
    render(<ExploreGraphLabel {...defaultProps} unit="bytes" />);
    expect(screen.getByTestId('unit-picker')).toHaveTextContent('bytes');
  });

  it('calls onChangeUnit when unit is changed', async () => {
    const onChangeUnit = jest.fn();
    render(<ExploreGraphLabel {...defaultProps} onChangeUnit={onChangeUnit} />);
    await userEvent.click(screen.getByTestId('unit-picker'));
    expect(onChangeUnit).toHaveBeenCalledWith('bytes');
  });

  it('calls onChangeGraphStyle when graph style is changed', async () => {
    const onChangeGraphStyle = jest.fn();
    render(<ExploreGraphLabel {...defaultProps} onChangeGraphStyle={onChangeGraphStyle} />);
    await userEvent.click(screen.getByTestId('graph-style-picker'));
    expect(onChangeGraphStyle).toHaveBeenCalledWith('lines');
  });
});
