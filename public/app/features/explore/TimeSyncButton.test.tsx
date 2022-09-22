import { render, screen } from '@testing-library/react';
import React from 'react';

import { TimeSyncButton } from './TimeSyncButton';

const setup = (isSynced: boolean) => {
  const onClick = () => {};
  return render(<TimeSyncButton onClick={onClick} isSynced={isSynced} />);
};

describe('TimeSyncButton', () => {
  it('should have the right name when isSynced = true', () => {
    setup(true);
    expect(screen.getByRole('button', { name: /synced times/i })).toBeInTheDocument();
  });
  it('should have the right name when isSynced = false', () => {
    setup(false);
    expect(screen.getByRole('button', { name: /unsynced times/i })).toBeInTheDocument();
  });
});
