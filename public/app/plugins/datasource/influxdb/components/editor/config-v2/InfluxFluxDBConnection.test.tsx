import '@testing-library/jest-dom';

import { render, screen, fireEvent } from '@testing-library/react';

import { InfluxFluxDBConnection } from './InfluxFluxDBConnection';
import { createTestProps } from './helpers';

describe('InfluxFluxDBConnection', () => {
  const onOptionsChangeMock = jest.fn();

  const defaultProps = createTestProps({
    options: {
      jsonData: {
        organization: 'MyOrg',
        defaultBucket: 'MyBucket',
      },
      secureJsonData: {
        token: 'my-token',
      },
      secureJsonFields: {
        token: true,
      },
    },
    mocks: {
      onOptionsChange: onOptionsChangeMock,
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders organization, bucket and token inputs', () => {
    render(<InfluxFluxDBConnection {...defaultProps} />);
    expect(screen.getByLabelText(/Organization/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Default Bucket/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Token/i)).toBeInTheDocument();
  });

  it('calls onOptionsChange on input change', () => {
    render(<InfluxFluxDBConnection {...defaultProps} />);
    const orgInput = screen.getByLabelText(/Organization/i);
    fireEvent.change(orgInput, { target: { value: 'NewOrg' } });
    expect(onOptionsChangeMock).toHaveBeenCalled();
  });
});
