import { render, screen, fireEvent } from '@testing-library/react';

import UpdateAllButton from './UpdateAllButton';

describe('UpdateAllButton', () => {
  const onUpdateAllMock = jest.fn();

  beforeEach(() => {
    onUpdateAllMock.mockClear();
  });

  it('should display "No updates available" when disabled', () => {
    render(<UpdateAllButton disabled={true} onUpdateAll={onUpdateAllMock} updatablePluginsLength={0} />);

    expect(screen.getByText('No updates available')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should display update count and be clickable when enabled', () => {
    render(<UpdateAllButton disabled={false} onUpdateAll={onUpdateAllMock} updatablePluginsLength={3} />);

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Update all (3)');
    expect(button).toBeEnabled();

    fireEvent.click(button);
    expect(onUpdateAllMock).toHaveBeenCalledTimes(1);
  });
});
