import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SilenceBell } from './SilenceBell';

describe('SilenceBell', () => {
  it('should not show the spinner initially', async () => {
    render(<SilenceBell silenced={false} />);
    expect(await screen.findByRole('button')).toBeInTheDocument();
  });

  it('should show the spinner after clicking the button and remove it after the function is done', async () => {
    const callback = async () => null;

    render(<SilenceBell silenced={false} onClick={callback} />);
    const button = await screen.findByRole('button');

    fireEvent.click(button);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    expect(await screen.findByRole('button')).toBeInTheDocument();
  });
});
