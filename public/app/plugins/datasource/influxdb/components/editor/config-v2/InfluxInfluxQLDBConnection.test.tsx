import '@testing-library/jest-dom';

import { render, screen, fireEvent } from '@testing-library/react';

import { InfluxInfluxQLDBConnection } from './InfluxInfluxQLDBConnection';
import { createTestProps } from './helpers';

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
    expect(screen.getByLabelText(/Database/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/User/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
  });

  it('calls onOptionsChange on input changes', () => {
    render(<InfluxInfluxQLDBConnection {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/User/i), { target: { value: 'newuser' } });
    expect(onOptionsChangeMock).toHaveBeenCalled();
  });
});
