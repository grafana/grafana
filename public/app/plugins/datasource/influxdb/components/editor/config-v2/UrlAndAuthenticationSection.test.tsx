import { render, screen, fireEvent } from '@testing-library/react';

import { InfluxVersion } from '../../../types';

import { UrlAndAuthenticationSection } from './UrlAndAuthenticationSection';
import { createTestProps } from './helpers';

describe('UrlAndAuthenticationSection', () => {
  const onOptionsChangeMock = jest.fn();

  const defaultProps = createTestProps({
    options: {
      jsonData: {
        url: 'http://localhost:8086',
        product: '',
        version: '',
      },
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

  it('calls onOptionsChange when URL is changed', () => {
    render(<UrlAndAuthenticationSection {...defaultProps} />);

    const input = screen.getByTestId('influxdb-v2-config-url-input');
    fireEvent.change(input, { target: { value: 'http://example.com' } });

    expect(onOptionsChangeMock).toHaveBeenCalled();
  });

  it('renders DRBP warning for InfluxDB OSS 1.x and InfluxQL', () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { product: 'InfluxDB OSS 1.x', version: InfluxVersion.InfluxQL },
      },
    };

    render(<UrlAndAuthenticationSection {...props} />);
    expect(screen.getByText(/requires DRBP mapping/i)).toBeInTheDocument();
  });

  it('renders DRBP warning for InfluxDB OSS 2.x and InfluxQL', () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { product: 'InfluxDB OSS 2.x', version: InfluxVersion.InfluxQL },
      },
    };

    render(<UrlAndAuthenticationSection {...props} />);
    expect(screen.getByText(/requires DRBP mapping/i)).toBeInTheDocument();
  });

  it('does not render DRBP warning for InfluxDB OSS 1.x and Flux', () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { product: 'InfluxDB OSS 1.x', version: InfluxVersion.Flux },
      },
    };

    render(<UrlAndAuthenticationSection {...props} />);
    expect(screen.queryByText(/requires DRBP mapping/i)).not.toBeInTheDocument();
  });

  it('does not render DRBP warning for InfluxDB OSS 2.x and Flux', () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { product: 'InfluxDB OSS 2.x', version: InfluxVersion.Flux },
      },
    };

    render(<UrlAndAuthenticationSection {...props} />);
    expect(screen.queryByText(/requires DRBP mapping/i)).not.toBeInTheDocument();
  });
});
