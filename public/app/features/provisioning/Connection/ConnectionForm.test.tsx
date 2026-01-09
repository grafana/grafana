import { QueryStatus } from '@reduxjs/toolkit/query';
import { render, screen, waitFor } from 'test/test-utils';

import { isFetchError } from '@grafana/runtime';
import { Connection } from 'app/api/clients/provisioning/v0alpha1';

import { useCreateOrUpdateConnection } from '../hooks/useCreateOrUpdateConnection';

import { ConnectionForm } from './ConnectionForm';

jest.mock('../hooks/useCreateOrUpdateConnection', () => ({
  useCreateOrUpdateConnection: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  isFetchError: jest.fn(),
  reportInteraction: jest.fn(),
}));

const mockSubmitData = jest.fn();
const mockUseCreateOrUpdateConnection = useCreateOrUpdateConnection as jest.MockedFunction<
  typeof useCreateOrUpdateConnection
>;
const mockIsFetchError = isFetchError as jest.MockedFunction<typeof isFetchError>;

type MockRequestState = {
  status: QueryStatus;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error?: unknown;
  reset: jest.Mock;
};

const createMockRequestState = (overrides: Partial<MockRequestState> = {}): MockRequestState => ({
  status: QueryStatus.uninitialized,
  isLoading: false,
  isSuccess: false,
  isError: false,
  reset: jest.fn(),
  ...overrides,
});

const createMockConnection = (overrides: Partial<Connection> = {}): Connection => ({
  metadata: { name: 'test-connection' },
  spec: {
    type: 'github',
    url: 'https://github.com/settings/installations/12345678',
    github: {
      appID: '123456',
      installationID: '12345678',
    },
  },
  secure: {
    privateKey: { name: 'configured' },
  },
  status: {
    state: 'connected',
    health: { healthy: true },
    observedGeneration: 1,
  },
  ...overrides,
});

interface SetupOptions {
  data?: Connection;
  requestState?: Partial<MockRequestState>;
}

function setup(options: SetupOptions = {}) {
  const { data, requestState = {} } = options;

  mockUseCreateOrUpdateConnection.mockReturnValue([
    mockSubmitData,
    createMockRequestState(requestState) as unknown as ReturnType<typeof useCreateOrUpdateConnection>[1],
  ]);

  return {
    mockSubmitData,
    ...render(<ConnectionForm data={data} />),
  };
}

describe('ConnectionForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubmitData.mockResolvedValue(undefined);
  });

  describe('Rendering - Create Mode', () => {
    it('should render all form fields', () => {
      setup();

      expect(screen.getByDisplayValue('GitHub')).toBeInTheDocument(); // Provider combobox
      expect(screen.getByPlaceholderText('123456')).toBeInTheDocument(); // App ID
      expect(screen.getByPlaceholderText('12345678')).toBeInTheDocument(); // Installation ID
      expect(screen.getByPlaceholderText(/-----BEGIN RSA PRIVATE KEY-----/i)).toBeInTheDocument(); // Private Key
    });

    it('should render Save button', () => {
      setup();

      expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    });

    it('should NOT render Delete button in create mode', () => {
      setup();

      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('should have Provider field disabled', () => {
      setup();

      expect(screen.getByDisplayValue('GitHub')).toBeDisabled();
    });
  });

  describe('Rendering - Edit Mode', () => {
    it('should populate form fields with existing connection data', () => {
      const mockData = createMockConnection();
      setup({ data: mockData });

      expect(screen.getByPlaceholderText('123456')).toHaveValue('123456');
      expect(screen.getByPlaceholderText('12345678')).toHaveValue('12345678');
    });

    it('should render Delete button in edit mode', () => {
      const mockData = createMockConnection();
      setup({ data: mockData });

      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('should show configured state for private key', () => {
      const mockData = createMockConnection();
      setup({ data: mockData });

      expect(screen.getByDisplayValue('configured')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show required error when fields are empty on submit', async () => {
      const { user } = setup();

      const saveButton = screen.getByRole('button', { name: /^save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getAllByText('This field is required')).toHaveLength(3);
      });
    });

    it('should not submit when required fields are missing', async () => {
      const { user, mockSubmitData } = setup();

      const saveButton = screen.getByRole('button', { name: /^save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getAllByText('This field is required')).toHaveLength(3);
      });

      expect(mockSubmitData).not.toHaveBeenCalled();
    });
  });

  describe('Form Submission - Create', () => {
    it('should call submitData with correct data on valid submission', async () => {
      const { user, mockSubmitData } = setup();

      await user.type(screen.getByPlaceholderText('123456'), '123456');
      await user.type(screen.getByPlaceholderText('12345678'), '12345678');
      await user.type(
        screen.getByPlaceholderText(/-----BEGIN RSA PRIVATE KEY-----/i),
        '-----BEGIN RSA PRIVATE KEY-----'
      );

      const saveButton = screen.getByRole('button', { name: /^save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockSubmitData).toHaveBeenCalledWith(
          {
            type: 'github',
            github: {
              appID: '123456',
              installationID: '12345678',
            },
          },
          '-----BEGIN RSA PRIVATE KEY-----'
        );
      });
    });
  });

  describe('Form Submission - Edit', () => {
    it('should allow submission without changing private key', async () => {
      const mockData = createMockConnection();
      const { user, mockSubmitData } = setup({ data: mockData });

      const saveButton = screen.getByRole('button', { name: /^save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockSubmitData).toHaveBeenCalledWith(
          {
            type: 'github',
            github: {
              appID: '123456',
              installationID: '12345678',
            },
          },
          'configured'
        );
      });
    });
  });

  describe('Loading State', () => {
    it('should disable Save button while loading', () => {
      setup({ requestState: { isLoading: true } });

      const saveButton = screen.getByRole('button', { name: /saving/i });
      expect(saveButton).toBeDisabled();
    });

    it('should show "Saving..." text while loading', () => {
      setup({ requestState: { isLoading: true } });

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should map API error for appID to form field', async () => {
      const { user, mockSubmitData } = setup();

      mockIsFetchError.mockReturnValue(true);
      mockSubmitData.mockRejectedValue({
        data: {
          errors: [
            {
              field: 'appID',
              detail: 'Invalid App ID',
            },
          ],
        },
      });

      await user.type(screen.getByPlaceholderText('123456'), '123456');
      await user.type(screen.getByPlaceholderText('12345678'), '12345678');
      await user.type(
        screen.getByPlaceholderText(/-----BEGIN RSA PRIVATE KEY-----/i),
        '-----BEGIN RSA PRIVATE KEY-----'
      );

      const saveButton = screen.getByRole('button', { name: /^save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid App ID')).toBeInTheDocument();
      });
    });

    it('should map API error for installationID to form field', async () => {
      const { user, mockSubmitData } = setup();

      mockIsFetchError.mockReturnValue(true);
      mockSubmitData.mockRejectedValue({
        data: {
          errors: [
            {
              field: 'installationID',
              detail: 'Invalid Installation ID',
            },
          ],
        },
      });

      await user.type(screen.getByPlaceholderText('123456'), '123456');
      await user.type(screen.getByPlaceholderText('12345678'), '12345678');
      await user.type(
        screen.getByPlaceholderText(/-----BEGIN RSA PRIVATE KEY-----/i),
        '-----BEGIN RSA PRIVATE KEY-----'
      );

      const saveButton = screen.getByRole('button', { name: /^save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid Installation ID')).toBeInTheDocument();
      });
    });

    it('should map API error for privateKey to form field', async () => {
      const { user, mockSubmitData } = setup();

      mockIsFetchError.mockReturnValue(true);
      mockSubmitData.mockRejectedValue({
        data: {
          errors: [
            {
              field: 'secure.privateKey',
              detail: 'Invalid Private Key format',
            },
          ],
        },
      });

      await user.type(screen.getByPlaceholderText('123456'), '123456');
      await user.type(screen.getByPlaceholderText('12345678'), '12345678');
      await user.type(screen.getByPlaceholderText(/-----BEGIN RSA PRIVATE KEY-----/i), 'invalid-key');

      const saveButton = screen.getByRole('button', { name: /^save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid Private Key format')).toBeInTheDocument();
      });
    });
  });
});
