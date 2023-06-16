import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { NewsContainer } from './NewsContainer';

const setup = () => {
  const { container } = render(<NewsContainer />);

  return { container };
};

describe('News', () => {
  it('should render the drawer when the drawer button is clicked', async () => {
    setup();

    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Latest from the blog')).toBeInTheDocument();
  });
});
