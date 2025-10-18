import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

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

      expect(screen.queryByText(/No Authentication/i)).not.toBeInTheDocument();
    });

    it('expands when the top‑level switch is toggled', () => {
      render(<AuthSettings {...defaultProps} />);

      fireEvent.click(screen.getByTestId('influxdb-v2-config-auth-settings-toggle'));

      expect(screen.getByText(/No Authentication/i)).toBeInTheDocument();
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
  describe('With Credentials toggle', () => {
    it('toggles checked state of the switch', () => {
      render(<AuthSettings {...defaultProps} />);
      fireEvent.click(screen.getByTestId('influxdb-v2-config-auth-settings-toggle'));
      const withCredentialsSwitch = screen.getByRole('checkbox', {
        name: /with credentials/i,
      });

      expect(withCredentialsSwitch).not.toBeChecked();

      fireEvent.click(withCredentialsSwitch);
      expect(withCredentialsSwitch).toBeChecked();

      fireEvent.click(withCredentialsSwitch);
      expect(withCredentialsSwitch).not.toBeChecked();
    });
  });
});
