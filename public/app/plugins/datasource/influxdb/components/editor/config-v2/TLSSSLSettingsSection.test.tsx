import { render, screen, fireEvent } from '@testing-library/react';

import { TLSSSLSettingsSection } from './TLSSSLSettingsSection';
import { createTestProps } from './helpers';

describe('TLSSSLSettingsSection', () => {
  const onOptionsChangeMock = jest.fn();
  let consoleSpy: jest.SpyInstance;

  const defaultProps = createTestProps({
    options: {
      jsonData: {
        tlsSkipVerify: false,
        tlsAuth: false,
        tlsAuthWithCACert: false,
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

  it('renders the three TLS checkboxes', () => {
    render(<TLSSSLSettingsSection {...defaultProps} />);
    const openTLSSection = screen.getByRole('button', { name: /tls\/ssl settings/i });
    fireEvent.click(openTLSSection);

    expect(screen.getByLabelText(/skip tls verify/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tls client auth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/with ca cert/i)).toBeInTheDocument();
  });

  it('calls onOptionsChange when toggling tlsSkipVerify', () => {
    render(<TLSSSLSettingsSection {...defaultProps} />);
    const openTLSSection = screen.getByRole('button', { name: /tls\/ssl settings/i });
    fireEvent.click(openTLSSection);

    const cb = screen.getByLabelText(/skip tls verify/i);
    fireEvent.click(cb);

    expect(onOptionsChangeMock).toHaveBeenCalled();
    const last = onOptionsChangeMock.mock.lastCall?.[0];
    expect(last.jsonData?.tlsSkipVerify).toBe(true);
  });

  it('shows Client Cert + Client Key inputs when tlsAuth is true', async () => {
    const props = createTestProps({
      options: {
        jsonData: { tlsSkipVerify: false, tlsAuth: true, tlsAuthWithCACert: false },
        secureJsonData: {},
        secureJsonFields: {},
      },
      mocks: { onOptionsChange: onOptionsChangeMock },
    });

    render(<TLSSSLSettingsSection {...props} />);

    expect(screen.getByText(/client cert/i)).toBeInTheDocument();
    expect(screen.getByText(/client key/i)).toBeInTheDocument();
  });

  it('updates secureJsonData.tlsClientCert when typing into Client certificate', () => {
    const props = createTestProps({
      options: {
        jsonData: { tlsSkipVerify: false, tlsAuth: true, tlsAuthWithCACert: false },
        secureJsonData: {},
        secureJsonFields: {},
      },
      mocks: { onOptionsChange: onOptionsChangeMock },
    });

    render(<TLSSSLSettingsSection {...props} />);

    const input = screen.getByPlaceholderText(/begins with -----begin certificate-----/i);
    fireEvent.change(input, { target: { value: '---CERT---' } });

    const last = onOptionsChangeMock.mock.lastCall?.[0];
    expect(last.secureJsonData?.tlsClientCert).toBe('---CERT---');
  });

  it('updates secureJsonData.tlsClientKey when typing into Client key', () => {
    const props = createTestProps({
      options: {
        jsonData: { tlsSkipVerify: false, tlsAuth: true, tlsAuthWithCACert: false },
        secureJsonData: {},
        secureJsonFields: {},
      },
      mocks: { onOptionsChange: onOptionsChangeMock },
    });

    render(<TLSSSLSettingsSection {...props} />);

    const input = screen.getByPlaceholderText(/begins with -----begin rsa private key-----/i);
    fireEvent.change(input, { target: { value: '---CERT---' } });

    const last = onOptionsChangeMock.mock.lastCall?.[0];
    expect(last.secureJsonData?.tlsClientKey).toBe('---CERT---');
  });

  it('updates secureJsonData.tlsCACert when typing into CA cert', () => {
    const props = createTestProps({
      options: {
        jsonData: { tlsSkipVerify: false, tlsAuth: false, tlsAuthWithCACert: true },
        secureJsonData: {},
        secureJsonFields: {},
      },
      mocks: { onOptionsChange: onOptionsChangeMock },
    });

    render(<TLSSSLSettingsSection {...props} />);

    const input = screen.getByPlaceholderText(/begins with -----begin certificate-----/i);
    fireEvent.change(input, { target: { value: '---CERT---' } });

    const last = onOptionsChangeMock.mock.lastCall?.[0];
    expect(last.secureJsonData?.tlsCACert).toBe('---CERT---');
  });

  it('shows CA certificate input when tlsAuthWithCACert is true', () => {
    const props = createTestProps({
      options: {
        jsonData: { tlsSkipVerify: false, tlsAuth: false, tlsAuthWithCACert: true },
        secureJsonData: {},
        secureJsonFields: { tlsCACert: false },
      },
      mocks: { onOptionsChange: onOptionsChangeMock },
    });

    render(<TLSSSLSettingsSection {...props} />);

    expect(screen.getByLabelText(/ca cert/i)).toBeInTheDocument();
  });
});
