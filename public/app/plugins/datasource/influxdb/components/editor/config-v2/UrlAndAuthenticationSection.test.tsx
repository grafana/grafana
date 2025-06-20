import { render, screen, fireEvent } from '@testing-library/react';

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

  it('renders DRBP warning for InfluxDB OSS 1.x', () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { product: 'InfluxDB OSS 1.x' },
      },
    };

    render(<UrlAndAuthenticationSection {...props} />);
    expect(screen.getByText(/requires DRBP mapping/i)).toBeInTheDocument();
  });
});
