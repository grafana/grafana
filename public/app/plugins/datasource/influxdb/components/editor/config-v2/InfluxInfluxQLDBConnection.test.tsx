import '@testing-library/jest-dom';

import { act, render, screen, fireEvent } from '@testing-library/react';

import { InfluxInfluxQLDBConnection } from './InfluxInfluxQLDBConnection';
import { createMockValidation, createTestProps } from './helpers';

describe('InfluxInfluxQLDBConnection', () => {
  const onOptionsChangeMock = jest.fn();

  const defaultProps = createTestProps({
    options: {
      user: 'admin',
      jsonData: {
        dbName: 'influxdb',
      },
      secureJsonData: {
        password: 'secret',
      },
      secureJsonFields: {
        password: true,
      },
    },
    mocks: {
      onOptionsChange: onOptionsChangeMock,
    },
  });

  it('renders dbName, user and password fields', () => {
    render(<InfluxInfluxQLDBConnection {...defaultProps} />);

    expect(screen.getByLabelText(/^Database\b/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^User\b/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password\b/i)).toBeInTheDocument();
  });

  it('calls onOptionsChange on input changes', () => {
    render(<InfluxInfluxQLDBConnection {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/User/i), { target: { value: 'newuser' } });

    expect(onOptionsChangeMock).toHaveBeenCalled();
  });

  describe('validation', () => {
    const emptyProps = createTestProps({
      options: {
        user: '',
        jsonData: { dbName: '' },
        secureJsonData: { password: '' },
        secureJsonFields: { password: false },
      },
      mocks: { onOptionsChange: jest.fn() },
    });

    it('shows inline errors for all required fields when validator is called with empty values', async () => {
      const validation = createMockValidation();
      render(<InfluxInfluxQLDBConnection {...emptyProps} validation={validation} />);

      await act(async () => {
        validation.runValidator();
      });

      expect(screen.getByText('Database is required')).toBeInTheDocument();
      expect(screen.getByText('User is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });

    it('shows no errors when all fields are filled', async () => {
      const validation = createMockValidation();
      render(<InfluxInfluxQLDBConnection {...defaultProps} validation={validation} />);

      await act(async () => {
        validation.runValidator();
      });

      expect(screen.queryByText('Database is required')).not.toBeInTheDocument();
      expect(screen.queryByText('User is required')).not.toBeInTheDocument();
      expect(screen.queryByText('Password is required')).not.toBeInTheDocument();
    });
  });
});
