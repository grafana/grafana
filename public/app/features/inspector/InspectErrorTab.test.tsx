import { render, screen } from '@testing-library/react';
import React from 'react';

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
    render(<InspectErrorTab errors={[error]} />);
    expect(screen.getByText('This is an error')).toBeInTheDocument();
    expect(screen.getByText('error:')).toBeInTheDocument();
    expect(screen.getByText('"my error"')).toBeInTheDocument();
  });

  it('should return a jsonFormatter object of error.message if it exists and data does not exist', () => {
    const error = {
      message:
        '{ "error": { "code": "BadRequest", "message": "Please provide below info when asking for support.", "details": [] } }',
    };
    const { container } = render(<InspectErrorTab errors={[error]} />);
    expect(container.childElementCount).toEqual(1);
    expect(screen.getByText('code:')).toBeInTheDocument();
    expect(screen.getByText('"BadRequest"')).toBeInTheDocument();
    expect(screen.getByText('"Please provide below info when asking for support."')).toBeInTheDocument();
  });

  it('should return an h3 and jsonFormatter object of error.message if it exists and data does not exist', () => {
    const error = {
      message:
        '400 BadRequest, Error from Azure: { "error": { "code": "BadRequest", "message": "Please provide below info when asking for support.", "details": [] } }',
    };
    const { container } = render(<InspectErrorTab errors={[error]} />);
    expect(container.childElementCount).toEqual(2);
    expect(screen.getByRole('heading', { name: '400 BadRequest, Error from Azure:' })).toBeInTheDocument();
    expect(screen.getByText('code:')).toBeInTheDocument();
    expect(screen.getByText('"BadRequest"')).toBeInTheDocument();
  });

  [
    '{ invalidJSON{',
    "hello, I am an error that's just text, no json at all, altoough I do mention template variables {{test}}",
    'and I am a simple string',
  ].forEach((errMsg) => {
    it(`should return error.message error.data does not exist nd error.message cannot be parsed - ${errMsg} `, () => {
      const error = {
        message: errMsg,
      };
      render(<InspectErrorTab errors={[error]} />);
      expect(screen.queryByRole('heading')).toBeNull();
      expect(screen.getByText(errMsg)).toBeInTheDocument();
    });
  });

  it('should return a jsonFormatter object of error if it has no .data and no .message', () => {
    const error = {
      status: 400,
    };
    const { container } = render(<InspectErrorTab errors={[error]} />);
    expect(container.childElementCount).toEqual(1);
    expect(screen.getByText('status:')).toBeInTheDocument();
    expect(screen.getByText('400')).toBeInTheDocument();
  });

  it('should return a message along with a status', () => {
    const error = {
      status: 400,
      message: 'This is an error',
    };
    render(<InspectErrorTab errors={[error]} />);
    expect(screen.getByText(/This is an error/)).toBeInTheDocument();
    expect(screen.getByText(/Status: 400/)).toBeInTheDocument();
  });

  it('should return a JSON encoded object along with a status', () => {
    const error = {
      status: 400,
      message:
        '{ "error": { "code": "BadRequest", "message": "Please provide below info when asking for support.", "details": [] } }',
    };
    render(<InspectErrorTab errors={[error]} />);
    expect(screen.getByText('"BadRequest"')).toBeInTheDocument();
    expect(screen.getByText(/Status: 400/)).toBeInTheDocument();
  });

  it('should return multiple errors', () => {
    const errors = [
      {
        status: 400,
        message: 'This is one error',
      },
      {
        status: 401,
        message: 'This is another error',
      },
    ];
    render(<InspectErrorTab errors={errors} />);
    expect(screen.getByText(/This is one error/)).toBeInTheDocument();
    expect(screen.getByText(/Status: 400/)).toBeInTheDocument();
    expect(screen.getByText(/This is another error/)).toBeInTheDocument();
    expect(screen.getByText(/Status: 401/)).toBeInTheDocument();
  });
});
