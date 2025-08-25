import { render, screen, fireEvent, waitFor } from '@testing-library/react';

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

  it('leaves product and version undefined when URL does not match any product', async () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { ...defaultProps.options.jsonData, url: undefined },
      },
    };

    render(<UrlAndAuthenticationSection {...props} />);

    const input = screen.getByTestId('influxdb-v2-config-url-input');
    onOptionsChangeMock.mockClear();
    fireEvent.blur(input, { target: { value: 'https://some-random-host.example.com' } });

    await waitFor(() => {
      expect(onOptionsChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonData: expect.objectContaining({
            product: undefined,
            version: undefined,
          }),
        })
      );
    });
  });

  it('auto-detects InfluxDB Cloud Dedicated from url', async () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { ...defaultProps.options.jsonData, url: '' },
      },
    };

    render(<UrlAndAuthenticationSection {...props} />);

    const input = screen.getByTestId('influxdb-v2-config-url-input');
    onOptionsChangeMock.mockClear();
    fireEvent.blur(input, { target: { value: 'influxdb.io' } });

    await waitFor(() => {
      expect(onOptionsChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonData: expect.objectContaining({
            product: 'InfluxDB Cloud Dedicated',
            version: undefined,
          }),
        })
      );
    });
  });

  it('auto-detects InfluxDB Cloud Serverless from url', async () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { ...defaultProps.options.jsonData, url: '' },
      },
    };

    render(<UrlAndAuthenticationSection {...props} />);
    const input = screen.getByTestId('influxdb-v2-config-url-input');

    onOptionsChangeMock.mockClear();
    fireEvent.blur(input, { target: { value: 'https://us-east-1-1.aws.cloud2.influxdata.com' } });

    await waitFor(() => {
      expect(onOptionsChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonData: expect.objectContaining({
            product: 'InfluxDB Cloud Serverless',
            version: undefined,
          }),
        })
      );
    });
  });

  it('auto-detects InfluxDB Cloud (TSM) from url', async () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { ...defaultProps.options.jsonData, url: '' },
      },
    };

    render(<UrlAndAuthenticationSection {...props} />);
    const input = screen.getByTestId('influxdb-v2-config-url-input');

    onOptionsChangeMock.mockClear();
    fireEvent.blur(input, { target: { value: 'https://us-west-2-1.aws.cloud2.influxdata.com' } });

    await waitFor(() => {
      expect(onOptionsChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonData: expect.objectContaining({
            product: 'InfluxDB Cloud (TSM)',
            version: undefined,
          }),
        })
      );
    });
  });

  it('auto-detects InfluxDB Cloud 1 from url', async () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { ...defaultProps.options.jsonData, url: '' },
      },
    };

    render(<UrlAndAuthenticationSection {...props} />);
    const input = screen.getByTestId('influxdb-v2-config-url-input');

    onOptionsChangeMock.mockClear();
    fireEvent.blur(input, { target: { value: 'https://influxcloud.net' } });

    await waitFor(() => {
      expect(onOptionsChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonData: expect.objectContaining({
            product: 'InfluxDB Cloud 1',
            version: undefined,
          }),
        })
      );
    });
  });

  it('clears product and version when URL changes to one without a match', async () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { ...defaultProps.options.jsonData, url: '' },
      },
    };

    render(<UrlAndAuthenticationSection {...props} />);
    const input = screen.getByTestId('influxdb-v2-config-url-input');

    onOptionsChangeMock.mockClear();
    fireEvent.blur(input, { target: { value: 'https://us-east-1-1.aws.cloud2.influxdata.com' } });

    await waitFor(() => {
      expect(onOptionsChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonData: expect.objectContaining({
            product: 'InfluxDB Cloud Serverless',
            version: undefined,
          }),
        })
      );
    });

    onOptionsChangeMock.mockClear();
    fireEvent.blur(input, { target: { value: 'https://influxdb.example.com' } });

    await waitFor(() => {
      expect(onOptionsChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonData: expect.objectContaining({
            product: undefined,
            version: undefined,
          }),
        })
      );
    });
  });

});
