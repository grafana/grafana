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

  const productsRequiringDBRP = [
    'InfluxDB OSS 1.x',
    'InfluxDB OSS 2.x',
    'InfluxDB Enterprise 1.x',
    'InfluxDB Cloud (TSM)',
    'InfluxDB Cloud Serverless',
  ];

  describe('UrlAndAuthenticationSection', () => {
    it.each(productsRequiringDBRP)('renders DBRP warning for %s and InfluxQL', (product) => {
      const props = {
        ...defaultProps,
        options: {
          ...defaultProps.options,
          jsonData: {
            product,
            version: InfluxVersion.InfluxQL,
          },
        },
      };

      render(<UrlAndAuthenticationSection {...props} />);
      expect(screen.getByText(/requires DBRP mapping/i)).toBeInTheDocument();
    });
  });

  it('does not render DBRP warning for SQL', () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { version: InfluxVersion.SQL },
      },
    };

    render(<UrlAndAuthenticationSection {...props} />);
    expect(screen.queryByText(/requires DBRP mapping/i)).not.toBeInTheDocument();
  });

  it('does not render DBRP warning for Flux', () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { version: InfluxVersion.Flux },
      },
    };

    render(<UrlAndAuthenticationSection {...props} />);
    expect(screen.queryByText(/requires DBRP mapping/i)).not.toBeInTheDocument();
  });
});
