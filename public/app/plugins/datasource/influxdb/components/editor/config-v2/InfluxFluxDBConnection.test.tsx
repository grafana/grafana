import '@testing-library/jest-dom';

import { act, render, screen, fireEvent } from '@testing-library/react';

import { InfluxFluxDBConnection } from './InfluxFluxDBConnection';
import { createMockValidation, createTestProps } from './helpers';

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

  describe('validation', () => {
    const emptyProps = createTestProps({
      options: {
        jsonData: { organization: '', defaultBucket: '' },
        secureJsonData: { token: '' },
        secureJsonFields: { token: false },
      },
      mocks: { onOptionsChange: jest.fn() },
    });

    it('shows inline errors for all required fields when validator is called with empty values', async () => {
      const validation = createMockValidation();
      render(<InfluxFluxDBConnection {...emptyProps} validation={validation} />);

      await act(async () => {
        validation.runValidator();
      });

      expect(screen.getByText('Organization is required')).toBeInTheDocument();
      expect(screen.getByText('Default bucket is required')).toBeInTheDocument();
      expect(screen.getByText('Token is required')).toBeInTheDocument();
    });

    it('shows no errors when all fields are filled', async () => {
      const validation = createMockValidation();
      render(<InfluxFluxDBConnection {...defaultProps} validation={validation} />);

      await act(async () => {
        validation.runValidator();
      });

      expect(screen.queryByText('Organization is required')).not.toBeInTheDocument();
      expect(screen.queryByText('Default bucket is required')).not.toBeInTheDocument();
      expect(screen.queryByText('Token is required')).not.toBeInTheDocument();
    });
  });
});
