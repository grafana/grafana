import React from 'react';
import { render } from '@testing-library/react';
import { AddToDashboardButton } from '.';

describe('Add to Dashboard', () => {
  it('Opens modal when clicked', () => {
    render(<AddToDashboardButton queries={[]} visualization="table" />);
  });
});
