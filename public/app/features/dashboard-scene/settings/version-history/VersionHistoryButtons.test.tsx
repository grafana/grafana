import { render, screen, fireEvent } from '@testing-library/react';

import { VersionsHistoryButtons } from './VersionHistoryButtons';

describe('VersionHistoryButtons', () => {
  it('renders compare button enabled when canCompare is true', () => {
    const getDiff = jest.fn();
    render(<VersionsHistoryButtons canCompare={true} getDiff={getDiff} />);

    const compareButton = screen.getByRole('button', { name: /compare versions/i });
    expect(compareButton).toBeEnabled();

    fireEvent.click(compareButton);
    expect(getDiff).toHaveBeenCalled();
  });

  it('renders compare button disabled when canCompare is false', () => {
    render(<VersionsHistoryButtons canCompare={false} getDiff={jest.fn()} />);

    const compareButton = screen.getByRole('button', { name: /compare versions/i });
    expect(compareButton).toBeDisabled();
  });
});
