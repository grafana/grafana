import { render, screen } from '@testing-library/react';
import React from 'react';

import { CenteredButton } from './CenteredButton';

describe('CenteredButton::', () => {
  it('should pass props to child component', () => {
    render(<CenteredButton data-testid="foobar">Test</CenteredButton>);

    expect(screen.getAllByTestId('foobar')).toHaveLength(1);
  });
});
