import React, { FC } from 'react';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';
import { captureException } from '@sentry/browser';

jest.mock('@sentry/browser');

const ErrorThrower: FC<{ error: Error }> = ({ error }) => {
  throw error;
};

describe('ErrorBoundary', () => {
  it('should catch error and report it to sentry, including react component stack in context', async () => {
    const problem = new Error('things went terribly wrong');
    render(
      <ErrorBoundary>
        {({ error }) => {
          if (!error) {
            return <ErrorThrower error={problem} />;
          } else {
            return <p>{error.message}</p>;
          }
        }}
      </ErrorBoundary>
    );

    await screen.findByText(problem.message);
    expect(captureException).toHaveBeenCalledTimes(1);
    const [error, context] = (captureException as jest.Mock).mock.calls[0];
    expect(error).toBe(problem);
    expect(context).toHaveProperty('contexts');
    expect(context.contexts).toHaveProperty('react');
    expect(context.contexts.react).toHaveProperty('componentStack');
    expect(context.contexts.react.componentStack).toMatch(/^\s+at ErrorThrower (.*)\s+at ErrorBoundary (.*)\s*$/);
  });
});
