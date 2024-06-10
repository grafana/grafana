import { render } from '@testing-library/react';
import React from 'react';

import { Button } from './Button';

describe('Button', () => {
  it('spins the spinner when specified as an icon', () => {
    const { container } = render(<Button icon="spinner">Loading...</Button>);
    expect(container.querySelector('.fa-spin')).toBeInTheDocument();
  });
});
