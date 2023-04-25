import { render, screen } from '@testing-library/react';
import React from 'react';

import { LoaderButton } from './LoaderButton';

const buttonLabel = 'Test button';

describe('LoaderButton::', () => {
  it('should display a spinner when in loading state, not button text', async () => {
    const { container } = render(<LoaderButton loading>Loading test</LoaderButton>);

    expect(await screen.findByRole('button')).toBeInTheDocument();
    expect(await screen.queryByText('Loading test')).not.toBeInTheDocument();
    expect(container.querySelectorAll('i').length).toEqual(1);
  });

  it('should display the children if not in loading state', async () => {
    const { container } = render(<LoaderButton>{buttonLabel}</LoaderButton>);

    expect(await screen.findByRole('button')).toBeInTheDocument();
    expect(await screen.queryByText(buttonLabel)).toBeInTheDocument();
    expect(container.querySelectorAll('i').length).toEqual(0);
  });
});
