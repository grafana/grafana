import { Meta } from '@storybook/react';
import { useState } from 'react';

import { Alert } from '../Alert/Alert';
import { Button } from '../Button/Button';

import { ErrorBoundary, ErrorBoundaryAlert } from './ErrorBoundary';
import mdx from './ErrorBoundary.mdx';
import { ErrorWithStack } from './ErrorWithStack';

const meta: Meta<typeof ErrorBoundary> = {
  title: 'Utilities/ErrorBoundary',
  component: ErrorBoundary,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const BuggyComponent = () => {
  const [count, setCount] = useState(0);

  if (count > 2) {
    throw new Error('Crashed');
  }

  return (
    <div>
      <p>Increase the count to 3 to trigger error</p>
      <Button onClick={() => setCount(count + 1)}>{count.toString()}</Button>
    </div>
  );
};

export const Basic = () => {
  return (
    <ErrorBoundary>
      {({ error }) => {
        if (error) {
          return <Alert title={error.message} />;
        }
        return <BuggyComponent />;
      }}
    </ErrorBoundary>
  );
};

export const WithStack = () => {
  return <ErrorWithStack error={new Error('Test error')} title={'Unexpected error'} errorInfo={null} />;
};

export const BoundaryAlert = () => {
  return (
    <ErrorBoundaryAlert>
      <BuggyComponent />
    </ErrorBoundaryAlert>
  );
};

export default meta;
