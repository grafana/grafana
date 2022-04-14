import React from 'react';
import { DiscoveryDocs } from './DiscoveryDocs';
import { render, screen } from '@testing-library/react';

describe('DiscoveryDocs:: ', () => {
  it('should render list with two buttons for the docs', () => {
    render(<DiscoveryDocs />);

    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
