import '@testing-library/jest-dom';

import { render, screen, fireEvent } from '@testing-library/react';

import { InfluxSQLDBConnection } from './InfluxSQLDBConnection';
import { createTestProps } from './helpers';

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
});
