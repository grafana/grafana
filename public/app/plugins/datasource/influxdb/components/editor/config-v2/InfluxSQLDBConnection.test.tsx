import '@testing-library/jest-dom';

import { act, render, screen, fireEvent } from '@testing-library/react';

import { InfluxSQLDBConnection } from './InfluxSQLDBConnection';
import { createMockValidation, createTestProps } from './helpers';

describe('InfluxSQLDBConnection', () => {
  const onOptionsChangeMock = jest.fn();

  const defaultProps = createTestProps({
    options: {
      jsonData: {
        dbName: 'testdb',
      },
      secureJsonData: {
        token: 'abc123',
      },
      secureJsonFields: {
        token: true,
      },
    },
    mocks: {
      onOptionsChange: onOptionsChangeMock,
    },
  });

  it('renders database and token fields', () => {
    render(<InfluxSQLDBConnection {...defaultProps} />);
    expect(screen.getByLabelText(/Database/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Token/i)).toBeInTheDocument();
  });

  it('calls onOptionsChange on dbName change', () => {
    render(<InfluxSQLDBConnection {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/Database/i), { target: { value: 'newdb' } });
    expect(onOptionsChangeMock).toHaveBeenCalled();
  });

  describe('validation', () => {
    const emptyProps = createTestProps({
      options: {
        jsonData: { dbName: '' },
        secureJsonData: { token: '' },
        secureJsonFields: { token: false },
      },
      mocks: { onOptionsChange: jest.fn() },
    });

    it('shows inline errors for all required fields when validator is called with empty values', async () => {
      const validation = createMockValidation();
      render(<InfluxSQLDBConnection {...emptyProps} validation={validation} />);

      await act(async () => {
        validation.runValidator();
      });

      expect(screen.getByText('Database is required')).toBeInTheDocument();
      expect(screen.getByText('Token is required')).toBeInTheDocument();
    });

    it('shows no errors when all fields are filled', async () => {
      const validation = createMockValidation();
      render(<InfluxSQLDBConnection {...defaultProps} validation={validation} />);

      await act(async () => {
        validation.runValidator();
      });

      expect(screen.queryByText('Database is required')).not.toBeInTheDocument();
      expect(screen.queryByText('Token is required')).not.toBeInTheDocument();
    });
  });
});
