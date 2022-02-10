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
    expect(container.childElementCount).toEqual(2);
    expect(screen.getByText('This is an error')).toBeInTheDocument();
  });
  it('should return a jsonFormatter object of error.message if it exists and data does not exist', () => {
    const error = {
      message:
        '{ "error": { "code": "BadRequest", "message": "Please provide below info when asking for support.", "details": [] } }',
    };
    const { container } = render(<InspectErrorTab error={error} />);
    expect(container.childElementCount).toEqual(1);
    expect(screen.getByText('code:')).toBeInTheDocument();
    expect(screen.getByText('"BadRequest"')).toBeInTheDocument();
    expect(screen.getByText('"Please provide below info when asking for support."')).toBeInTheDocument();
  });
  it('should return error.message error.data does not exist nd error.message cannot be parsed', () => {
    const error = {
      message: '{ invalidJSON{',
    };
    const { container } = render(<InspectErrorTab error={error} />);
    expect(container.childElementCount).toEqual(1);
    expect(screen.getByText('{ invalidJSON{')).toBeInTheDocument();
  });
  it('should return a jsonFormatter object of error if it has no .data and no .message', () => {
    const error = {
      status: '400',
    };
    const { container } = render(<InspectErrorTab error={error} />);
    expect(container.childElementCount).toEqual(1);
    expect(screen.getByText('status:')).toBeInTheDocument();
    expect(screen.getByText('"400"')).toBeInTheDocument();
  });
});
