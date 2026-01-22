import { QueryStatus } from '@reduxjs/toolkit/query';
import { render, screen, waitFor } from 'test/test-utils';

import { Connection } from 'app/api/clients/provisioning/v0alpha1';

import { useCreateOrUpdateConnection } from '../hooks/useCreateOrUpdateConnection';

import { ConnectionForm } from './ConnectionForm';

jest.mock('../hooks/useCreateOrUpdateConnection', () => ({
  useCreateOrUpdateConnection: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const mockSubmitData = jest.fn();
const mockUseCreateOrUpdateConnection = useCreateOrUpdateConnection as jest.MockedFunction<
  typeof useCreateOrUpdateConnection
>;

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

      expect(screen.getByLabelText(/^Provider/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^GitHub App ID/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^GitHub Installation ID/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Private Key \(PEM\)/)).toBeInTheDocument();
    });

    it('should render Save button', () => {
      setup();

      expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    });

    it('should not render Delete button in create mode', () => {
      setup();

      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('should have Provider field disabled', () => {
      setup();

      expect(screen.getByLabelText(/^Provider/)).toBeDisabled();
    });
  });

  describe('Rendering - Edit Mode', () => {
    it('should populate form fields with existing connection data', () => {
      setup({ data: createMockConnection() });

      expect(screen.getByLabelText(/^GitHub App ID/)).toHaveValue('123456');
      expect(screen.getByLabelText(/^GitHub Installation ID/)).toHaveValue('12345678');
    });

    it('should render Delete button in edit mode', () => {
      setup({ data: createMockConnection() });

      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('should show configured state for private key', () => {
      setup({ data: createMockConnection() });

      expect(screen.getByLabelText(/^Private Key \(PEM\)/)).toHaveValue('configured');
    });
  });

  describe('Form Validation', () => {
    it('should show required error and not submit when fields are empty', async () => {
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

      await user.type(screen.getByLabelText(/^GitHub App ID/), '123456');
      await user.type(screen.getByLabelText(/^GitHub Installation ID/), '12345678');
      await user.type(screen.getByLabelText(/^Private Key \(PEM\)/), '-----BEGIN RSA PRIVATE KEY-----');

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
      const { user, mockSubmitData } = setup({ data: createMockConnection() });

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
          '' // privateKey is set to empty string by default
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

      mockSubmitData.mockRejectedValue({
        status: 400,
        data: { errors: [{ field: 'appID', detail: 'Invalid App ID' }] },
      });

      await user.type(screen.getByLabelText(/^GitHub App ID/), '123456');
      await user.type(screen.getByLabelText(/^GitHub Installation ID/), '12345678');
      await user.type(screen.getByLabelText(/^Private Key \(PEM\)/), '-----BEGIN RSA PRIVATE KEY-----');

      const saveButton = screen.getByRole('button', { name: /^save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid App ID')).toBeInTheDocument();
      });
    });

    it('should map API error for installationID to form field', async () => {
      const { user, mockSubmitData } = setup();

      mockSubmitData.mockRejectedValue({
        status: 400,
        data: { errors: [{ field: 'installationID', detail: 'Invalid Installation ID' }] },
      });

      await user.type(screen.getByLabelText(/^GitHub App ID/), '123456');
      await user.type(screen.getByLabelText(/^GitHub Installation ID/), '12345678');
      await user.type(screen.getByLabelText(/^Private Key \(PEM\)/), '-----BEGIN RSA PRIVATE KEY-----');

      const saveButton = screen.getByRole('button', { name: /^save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid Installation ID')).toBeInTheDocument();
      });
    });

    it('should map API error for privateKey to form field', async () => {
      const { user, mockSubmitData } = setup();

      mockSubmitData.mockRejectedValue({
        status: 400,
        data: { errors: [{ field: 'secure.privateKey', detail: 'Invalid Private Key format' }] },
      });

      await user.type(screen.getByLabelText(/^GitHub App ID/), '123456');
      await user.type(screen.getByLabelText(/^GitHub Installation ID/), '12345678');
      await user.type(screen.getByLabelText(/^Private Key \(PEM\)/), 'invalid-key');

      const saveButton = screen.getByRole('button', { name: /^save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid Private Key format')).toBeInTheDocument();
      });
    });
  });
});
