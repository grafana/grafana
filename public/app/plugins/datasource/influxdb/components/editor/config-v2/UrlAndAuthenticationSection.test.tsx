import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { InfluxVersion } from '../../../types';

import { UrlAndAuthenticationSection } from './UrlAndAuthenticationSection';
import { createTestProps } from './helpers';

describe('UrlAndAuthenticationSection', () => {
  const onOptionsChangeMock = jest.fn();
  let consoleSpy: jest.SpyInstance;

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
    // Mock console.error to suppress React act() warnings
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
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

  it('sets product to OSS 1.x when ping returns a match for OSS 1.x', async () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { ...defaultProps.options.jsonData, url: '' },
      },
    };

    mockFetchPing({ ok: true, build: 'OSS', version: '1.8.10' });

    render(<UrlAndAuthenticationSection {...props} />);
    const input = screen.getByTestId('influxdb-v2-config-url-input');

    onOptionsChangeMock.mockClear();
    fireEvent.blur(input, { target: { value: 'https://someinfluxoss1url.com' } });

    await waitFor(() => {
      expect(onOptionsChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonData: expect.objectContaining({
            product: 'InfluxDB OSS 1.x',
            version: undefined,
          }),
        })
      );
    });
  });

  it('sets product to OSS 2.x when ping returns a match for OSS 2.x', async () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { ...defaultProps.options.jsonData, url: '' },
      },
    };

    mockFetchPing({ ok: true, build: 'OSS', version: '2.7.1' });

    render(<UrlAndAuthenticationSection {...props} />);
    const input = screen.getByTestId('influxdb-v2-config-url-input');

    onOptionsChangeMock.mockClear();
    fireEvent.blur(input, { target: { value: 'https://someinfluxoss2url.com' } });

    await waitFor(() => {
      expect(onOptionsChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonData: expect.objectContaining({
            product: 'InfluxDB OSS 2.x',
            version: undefined,
          }),
        })
      );
    });
  });

  it('sets product as undefined if ping does not return a match', async () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { ...defaultProps.options.jsonData, url: '' },
      },
    };

    mockFetchPing({ ok: true, build: undefined, version: undefined });

    render(<UrlAndAuthenticationSection {...props} />);
    const input = screen.getByTestId('influxdb-v2-config-url-input');

    onOptionsChangeMock.mockClear();
    fireEvent.blur(input, { target: { value: 'https://no-known-pattern.example.com' } });

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

export function mockFetchPing(resp: { ok?: boolean; build?: string; version?: string } = {}) {
  const { ok = true, build, version } = resp;

  global.fetch = jest.fn().mockResolvedValue({
    ok,
    headers: {
      get: (key: string) => {
        const normalized = key.toLowerCase();
        if (normalized === 'x-influxdb-build') {
          return build ?? null;
        }
        if (normalized === 'x-influxdb-version') {
          return version ?? null;
        }
        return null;
      },
    },
  });
}
