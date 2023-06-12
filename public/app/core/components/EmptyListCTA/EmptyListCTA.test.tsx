import { render, screen } from '@testing-library/react';
import React from 'react';

import EmptyListCTA from './EmptyListCTA';

describe('EmptyListCTA', () => {
  it('should return a button element if there is no buttonLink prop', () => {
    render(<EmptyListCTA title="title" buttonIcon="plus" buttonTitle="button title" />);

    expect(screen.getByRole('button', { name: 'button title' }));
  });

  it('should return an anchor element if there is a buttonLink prop', () => {
    render(<EmptyListCTA title="title" buttonIcon="plus" buttonLink="href" buttonTitle="button title" />);

    expect(screen.getByRole('link', { name: 'button title' }));
  });
});
