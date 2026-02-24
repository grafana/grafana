import { createMemoryHistory } from 'history';
import { render, renderHook, screen, userEvent } from 'test/test-utils';

import { locationService } from '@grafana/runtime';

import { useCancelWizardModal } from './useCancelWizardModal';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    push: jest.fn(),
    getHistory: jest.fn(),
  },
}));

describe('useCancelWizardModal', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    const history = createMemoryHistory();
    (locationService.getHistory as jest.Mock).mockReturnValue(history);
  });

  describe('when form is not dirty', () => {
    it('should navigate immediately without showing modal', () => {
      const { result } = renderHook(() => useCancelWizardModal({ isDirty: false, redirectUrl: '/alerting/list' }));

      const [, handleCancel] = result.current;
      handleCancel();

      expect(locationService.push).toHaveBeenCalledWith('/alerting/list');
    });

    it('should use default redirect URL when not provided', () => {
      const { result } = renderHook(() => useCancelWizardModal({ isDirty: false }));

      const [, handleCancel] = result.current;
      handleCancel();

      expect(locationService.push).toHaveBeenCalledWith('/alerting/list');
    });
  });

  describe('when form is dirty', () => {
    function createTestComponent(options: { redirectUrl?: string } = {}) {
      return function TestComponent() {
        const [Modal, handleCancel] = useCancelWizardModal({
          isDirty: true,
          ...options,
        });
        return (
          <>
            <button onClick={handleCancel}>Cancel</button>
            {Modal}
          </>
        );
      };
    }

    it('should show confirmation modal instead of navigating', async () => {
      const TestComponent = createTestComponent();
      render(<TestComponent />);
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(await screen.findByRole('heading', { name: 'Cancel import?' })).toBeInTheDocument();
      expect(locationService.push).not.toHaveBeenCalled();
    });

    it('should navigate when user confirms in modal', async () => {
      const TestComponent = createTestComponent({ redirectUrl: '/custom/path' });
      render(<TestComponent />);
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await user.click(await screen.findByRole('button', { name: 'Discard changes' }));

      expect(locationService.push).toHaveBeenCalledWith('/custom/path');
    });

    it('should close modal when user dismisses', async () => {
      const TestComponent = createTestComponent();
      render(<TestComponent />);
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await user.click(await screen.findByRole('button', { name: 'Dismiss' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(locationService.push).not.toHaveBeenCalled();
    });
  });
});
