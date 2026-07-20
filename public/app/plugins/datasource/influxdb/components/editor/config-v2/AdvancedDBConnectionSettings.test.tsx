import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

import { InfluxVersion } from '../../../types';

import { AdvancedDbConnectionSettings } from './AdvancedDBConnectionSettings';
import { createTestProps } from './helpers';

describe('AdvancedDbConnectionSettings', () => {
  const onOptionsChangeMock = jest.fn();

  const defaultProps = createTestProps({
    options: {
      jsonData: {},
      secureJsonData: {},
      secureJsonFields: {},
    },
    mocks: {
      onOptionsChange: onOptionsChangeMock,
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('toggles visibility of advanced settings', () => {
    render(<AdvancedDbConnectionSettings {...defaultProps} />);
    const button = screen.getByTestId('influxdb-v2-config-toggle-button');
    fireEvent.click(button);
  });

  it('renders HTTP Method field for InfluxQL version', () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { version: InfluxVersion.InfluxQL },
      },
    };

    render(<AdvancedDbConnectionSettings {...props} />);
    const toggle = screen.getByTestId('influxdb-v2-config-toggle-button');
    fireEvent.click(toggle);
    expect(screen.getByTestId('influxdb-v2-config-http-method-select')).toBeInTheDocument();
  });

  it('renders insecure connection switch for SQL version and triggers change', () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { version: InfluxVersion.SQL, insecureGrpc: false },
      },
    };

    render(<AdvancedDbConnectionSettings {...props} />);
    const toggle = screen.getByTestId('influxdb-v2-config-toggle-button');
    fireEvent.click(toggle);

    const insecureCheckbox = screen.getByTestId('influxdb-v2-config-insecure-checkbox');
    expect(insecureCheckbox).toBeInTheDocument();
    fireEvent.click(insecureCheckbox);
    expect(onOptionsChangeMock).toHaveBeenCalled();
  });

  it('renders Min time interval input for InfluxQL', () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { version: InfluxVersion.InfluxQL, timeInterval: '' },
      },
    };

    render(<AdvancedDbConnectionSettings {...props} />);
    const toggle = screen.getByTestId('influxdb-v2-config-toggle-button');
    fireEvent.click(toggle);

    const input = screen.getByTestId('influxdb-v2-config-time-interval');
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '15' } });
    expect(onOptionsChangeMock).toHaveBeenCalled();
  });

  it('renders Min time interval input for Flux', () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { version: InfluxVersion.Flux, timeInterval: '' },
      },
    };

    render(<AdvancedDbConnectionSettings {...props} />);
    const toggle = screen.getByTestId('influxdb-v2-config-toggle-button');
    fireEvent.click(toggle);

    const input = screen.getByTestId('influxdb-v2-config-time-interval');
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '15' } });
    expect(onOptionsChangeMock).toHaveBeenCalled();
  });
});
