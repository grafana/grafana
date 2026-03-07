import { render, screen } from 'test/test-utils';

import { ConnectionStatus } from 'app/api/clients/provisioning/v0alpha1';

import { ConnectionStatusBadge } from './ConnectionStatusBadge';

const createMockStatus = (overrides: Partial<ConnectionStatus> = {}): ConnectionStatus => ({
  health: { healthy: true },
  observedGeneration: 1,
  conditions: [
    {
      type: 'Ready',
      status: 'True',
      reason: 'Available',
      message: 'Connection is available',
      lastTransitionTime: new Date().toISOString(),
      observedGeneration: 1,
    },
  ],
  ...overrides,
});

describe('ConnectionStatusBadge', () => {
  describe('Pending state', () => {
    it('should render pending badge when status is undefined', () => {
      render(<ConnectionStatusBadge />);

      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('should render pending badge when conditions array is empty', () => {
      const status = createMockStatus({ conditions: [] });
      render(<ConnectionStatusBadge status={status} />);

      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('should render pending badge when conditions is undefined', () => {
      const status = createMockStatus({ conditions: undefined });
      render(<ConnectionStatusBadge status={status} />);

      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('should render pending badge when no Ready condition exists', () => {
      const status = createMockStatus({
        conditions: [
          {
            type: 'Other',
            status: 'True',
            reason: 'Some reason',
            message: 'Some message',
            lastTransitionTime: new Date().toISOString(),
            observedGeneration: 1,
          },
        ],
      });
      render(<ConnectionStatusBadge status={status} />);

      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });

  describe('Connected state', () => {
    it('should render connected badge when Ready condition status is True', () => {
      const status = createMockStatus({
        conditions: [
          {
            type: 'Ready',
            status: 'True',
            reason: 'Available',
            message: 'Connection is available',
            lastTransitionTime: new Date().toISOString(),
            observedGeneration: 1,
          },
        ],
      });
      render(<ConnectionStatusBadge status={status} />);

      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  describe('Disconnected state', () => {
    it('should render disconnected badge when Ready condition status is False', () => {
      const status = createMockStatus({
        conditions: [
          {
            type: 'Ready',
            status: 'False',
            reason: 'Unavailable',
            message: 'Connection is unavailable',
            lastTransitionTime: new Date().toISOString(),
            observedGeneration: 1,
          },
        ],
      });
      render(<ConnectionStatusBadge status={status} />);

      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });
  });

  describe('Unknown state', () => {
    it('should render unknown badge when Ready condition status is neither True nor False', () => {
      const status = createMockStatus({
        conditions: [
          {
            type: 'Ready',
            status: 'Unknown' as string,
            reason: 'Unknown',
            message: 'Unknown status',
            lastTransitionTime: new Date().toISOString(),
            observedGeneration: 1,
          },
        ],
      });
      render(<ConnectionStatusBadge status={status} />);

      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('should render unknown badge when Ready condition status is empty string', () => {
      const status = createMockStatus({
        conditions: [
          {
            type: 'Ready',
            status: '' as string,
            reason: 'Unknown',
            message: 'Unknown status',
            lastTransitionTime: new Date().toISOString(),
            observedGeneration: 1,
          },
        ],
      });
      render(<ConnectionStatusBadge status={status} />);

      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });
});
