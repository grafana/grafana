import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ExploreVariableTypeSelection } from './ExploreVariableTypeSelection';

describe('ExploreVariableTypeSelection', () => {
  const onSelect = jest.fn();
  const onCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders exactly 4 type cards', () => {
    render(<ExploreVariableTypeSelection onSelect={onSelect} onCancel={onCancel} />);

    expect(screen.getByText('Custom')).toBeInTheDocument();
    expect(screen.getByText('Query')).toBeInTheDocument();
    expect(screen.getByText('Textbox')).toBeInTheDocument();
    expect(screen.getByText('Constant')).toBeInTheDocument();
  });

  it('does NOT render cards for unsupported variable types', () => {
    render(<ExploreVariableTypeSelection onSelect={onSelect} onCancel={onCancel} />);

    expect(screen.queryByText('Interval')).not.toBeInTheDocument();
    expect(screen.queryByText('Data source')).not.toBeInTheDocument();
    expect(screen.queryByText('Ad hoc filters')).not.toBeInTheDocument();
    expect(screen.queryByText('Group by')).not.toBeInTheDocument();
    expect(screen.queryByText('Switch')).not.toBeInTheDocument();
  });

  it('does not mention dashboard in any type card description', () => {
    const { container } = render(<ExploreVariableTypeSelection onSelect={onSelect} onCancel={onCancel} />);

    const allText = container.textContent ?? '';
    expect(allText.toLowerCase()).not.toContain('dashboard');
  });

  it('calls onSelect with the correct type when clicking a card', async () => {
    const user = userEvent.setup();
    render(<ExploreVariableTypeSelection onSelect={onSelect} onCancel={onCancel} />);

    await user.click(screen.getByText('Custom'));
    expect(onSelect).toHaveBeenCalledWith('custom');

    await user.click(screen.getByText('Query'));
    expect(onSelect).toHaveBeenCalledWith('query');

    await user.click(screen.getByText('Textbox'));
    expect(onSelect).toHaveBeenCalledWith('textbox');

    await user.click(screen.getByText('Constant'));
    expect(onSelect).toHaveBeenCalledWith('constant');
  });
});
