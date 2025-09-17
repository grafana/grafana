import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { AuthSettings } from './AuthSettings';
import { createTestProps } from './helpers';

describe('AuthSettings', () => {
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

  describe('collapsible behaviour', () => {
    it('starts collapsed when no auth option is active', () => {
      render(<AuthSettings {...defaultProps} />);

      // Heading inside the collapsible body should be absent
      expect(screen.queryByText(/Authentication Method/i)).not.toBeInTheDocument();
    });

    it('expands when the top‑level switch is toggled', () => {
      render(<AuthSettings {...defaultProps} />);

      fireEvent.click(screen.getByTestId('influxdb-v2-config-auth-settings-toggle'));

      expect(screen.getByText(/Authentication Method/i)).toBeInTheDocument();
    });
  });

  describe('Basic Auth', () => {
    beforeEach(() => {
      render(<AuthSettings {...defaultProps} />);

      // open section first
      fireEvent.click(screen.getByTestId('influxdb-v2-config-auth-settings-toggle'));
    });

    it('reveals Basic Auth inputs when Basic Auth is selected', () => {
      fireEvent.click(screen.getByRole('radio', { name: /Basic Auth/i }));

      expect(screen.getByPlaceholderText('User')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    });

    it('propagates user input via onOptionsChange', async () => {
      fireEvent.click(screen.getByRole('radio', { name: /Basic Auth/i }));

      fireEvent.change(screen.getByPlaceholderText('User'), {
        target: { value: 'john_doe' },
      });

      expect(onOptionsChangeMock).toHaveBeenCalledWith(expect.objectContaining({ basicAuthUser: 'john_doe' }));
    });
  });

  describe('TLS Settings', () => {
    beforeEach(() => {
      render(<AuthSettings {...defaultProps} />);

      // Expand the settings panel once for all tests
      fireEvent.click(screen.getByTestId('influxdb-v2-config-auth-settings-toggle'));
    });

    describe('TLS Client Auth', () => {
      it('shows and hides Server Name input when toggled Enabled/Disabled', () => {
        const tlsRow = screen.getByTestId('influxdb-v2-config-auth-settings-tls-client-auth-toggle');

        // Initially hidden
        expect(screen.queryByPlaceholderText('domain.example.com')).not.toBeInTheDocument();

        // Enable TLS Client Auth
        fireEvent.click(within(tlsRow).getByText('Enabled'));
        expect(screen.getByPlaceholderText('domain.example.com')).toBeInTheDocument();

        // Disable again
        fireEvent.click(within(tlsRow).getByText('Disabled'));
        expect(screen.queryByPlaceholderText('domain.example.com')).not.toBeInTheDocument();
      });
    });

    describe('CA Cert', () => {
      it('shows and hides certificate textarea when toggled Enabled/Disabled', () => {
        const placeholderText = 'Begins with -----BEGIN CERTIFICATE-----';

        const caRow = screen.getByTestId('influxdb-v2-config-auth-settings-ca-cert-toggle');
        const enabledRadio = within(caRow).getByText('Enabled');
        const disabledRadio = within(caRow).getByText('Disabled');

        // Initially hidden
        expect(screen.queryByPlaceholderText(placeholderText)).not.toBeInTheDocument();

        // Enable
        fireEvent.click(enabledRadio);
        expect(screen.getByPlaceholderText(placeholderText)).toBeInTheDocument();

        // Disable
        fireEvent.click(disabledRadio);
        expect(screen.queryByPlaceholderText(placeholderText)).not.toBeInTheDocument();
      });
    });

    describe('Skip TLS Verify', () => {
      it('toggles checked state of the switch', () => {
        const skipSwitch = screen.getByTestId('influxdb-v2-config-auth-settings-skip-tls-verify');

        // Default unchecked
        expect(skipSwitch).not.toBeChecked();

        // Enable
        fireEvent.click(skipSwitch);
        expect(skipSwitch).toBeChecked();

        // Disable
        fireEvent.click(skipSwitch);
        expect(skipSwitch).not.toBeChecked();
      });
    });

    describe('With Credentials toggle', () => {
      it('toggles checked state of the switch', () => {
        const withCredentialsSwitch = screen.getByTestId('influxdb-v2-config-auth-settings-with-credentials');

        // Default unchecked
        expect(withCredentialsSwitch).not.toBeChecked();

        // Enable
        fireEvent.click(withCredentialsSwitch);
        expect(withCredentialsSwitch).toBeChecked();

        // Disable
        fireEvent.click(withCredentialsSwitch);
        expect(withCredentialsSwitch).not.toBeChecked();
      });
    });
  });
});
