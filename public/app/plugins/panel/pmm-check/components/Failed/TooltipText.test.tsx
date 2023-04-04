import { render, screen } from '@testing-library/react';
import React from 'react';

import { TooltipText } from './TooltipText';

describe('TooltipText::', () => {
  it('should render a header with a sum of failed checks', () => {
    render(
      <TooltipText
        counts={{
          emergency: 1,
          critical: 1,
          alert: 1,
          error: 1,
          warning: 1,
          debug: 10,
          info: 2,
          notice: 3,
        }}
      />
    );

    expect(screen.getByText('Failed checks: 20')).toBeInTheDocument();
  });

  it('should render a body with failed checks detailed by severity', () => {
    render(
      <TooltipText
        counts={{
          emergency: 1,
          critical: 1,
          alert: 12,
          error: 1,
          warning: 1,
          debug: 1,
          info: 2,
          notice: 3,
        }}
      />
    );

    expect(screen.getByText('Emergency – 1')).toBeInTheDocument();
    expect(screen.getByText('Alert – 12')).toBeInTheDocument();
    expect(screen.getByText('Critical – 1')).toBeInTheDocument();
    expect(screen.getByText('Error – 1')).toBeInTheDocument();
    expect(screen.getByText('Warning – 1')).toBeInTheDocument();
    expect(screen.getByText('Notice – 3')).toBeInTheDocument();
    expect(screen.getByText('Info – 2')).toBeInTheDocument();
    expect(screen.getByText('Debug – 1')).toBeInTheDocument();
  });

  it('should render nothing when the sum is zero', () => {
    render(
      <TooltipText
        counts={{
          emergency: 0,
          critical: 0,
          alert: 0,
          error: 0,
          warning: 0,
          debug: 0,
          info: 0,
          notice: 0,
        }}
      />
    );

    expect(screen.queryByTestId('checks-tooltip-body')).not.toBeInTheDocument();
  });
});
