import React from 'react';
import { render, screen } from '@testing-library/react';
import { InspectErrorTab } from './InspectErrorTab';

describe('InspectErrorTab', () => {
  it('should return null when error does not exist', () => {
    const { container } = render(<InspectErrorTab />);
    expect(container.childElementCount).toEqual(0);
  });
  it('should return a jsonFormatter object of error.data if it exists', () => {
    const error = {
      data: {
        message: 'This is an error',
        error: 'my error',
      },
    };
    const { container } = render(<InspectErrorTab error={error} />);
    // const comp = render(<InspectErrorTab error={error} />);
    expect(container.childElementCount).toEqual(2);
    expect(screen.getByText('This is an error')).toBeInTheDocument();
    // expect(comp.('JSONFormatter')).toBeTruthy();
  });
});
