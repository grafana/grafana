import { render, screen, testWithFeatureToggles, waitFor, within } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { mockLocalStorage } from '../mocks';
import { getPreviewToggle, setPreviewToggle } from '../previewToggles';

import { RuleListPageTitle } from './RuleListPageTitle';

// Mock window.location.reload
const mockReload = jest.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

const ui = {
  title: byRole('heading', { name: 'Alert rules' }),
  useNewExperienceButton: byRole('button', { name: /use new experience/i }),
  revertButton: byRole('button', { name: /revert to previous experience/i }),
};

// Helper to get modal elements (modal uses dialog role)
function getModal() {
  return screen.getByRole('dialog');
}

function getModalRevertButton() {
  return within(getModal()).getByRole('button', { name: /revert to previous experience/i });
}

function getModalSeeActivityButton() {
  return within(getModal()).getByRole('button', { name: /see alert activity/i });
}

function queryModal() {
  return screen.queryByRole('dialog');
}

const localStorageMock = mockLocalStorage();
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Helper function for rendering the component
function renderRuleListPageTitle() {
  return render(<RuleListPageTitle title="Alert rules" />);
}

describe('RuleListPageTitle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  it('should render the title', () => {
    renderRuleListPageTitle();
    expect(ui.title.get()).toBeInTheDocument();
  });

  it('should not show toggle button when alertingListViewV2PreviewToggle feature flag is disabled', () => {
    renderRuleListPageTitle();
    expect(ui.useNewExperienceButton.query()).not.toBeInTheDocument();
    expect(ui.revertButton.query()).not.toBeInTheDocument();
  });

  describe('when on OLD view (alertingListViewV2PreviewToggle enabled, alertingListViewV2 disabled)', () => {
    testWithFeatureToggles({ enable: ['alertingListViewV2PreviewToggle'] });

    it('should show "Use new experience" button', () => {
      renderRuleListPageTitle();
      expect(ui.useNewExperienceButton.get()).toBeInTheDocument();
      expect(ui.revertButton.query()).not.toBeInTheDocument();
    });

    it('should switch directly to new experience without showing modal', async () => {
      const { user } = renderRuleListPageTitle();

      await user.click(ui.useNewExperienceButton.get());

      // Should NOT show the modal
      expect(queryModal()).not.toBeInTheDocument();

      // Should switch directly
      expect(getPreviewToggle('alertingListViewV2')).toBe(true);
      expect(mockReload).toHaveBeenCalled();
    });
  });

  describe('when on NEW view (alertingListViewV2PreviewToggle and alertingListViewV2 enabled)', () => {
    testWithFeatureToggles({ enable: ['alertingListViewV2PreviewToggle', 'alertingListViewV2'] });

    beforeEach(() => {
      setPreviewToggle('alertingListViewV2', true);
    });

    it('should show "Revert to previous experience" button', () => {
      renderRuleListPageTitle();
      expect(ui.revertButton.get()).toBeInTheDocument();
      expect(ui.useNewExperienceButton.query()).not.toBeInTheDocument();
    });

    it('should show confirmation modal when clicking revert button', async () => {
      const { user } = renderRuleListPageTitle();

      await user.click(ui.revertButton.get());

      // Modal should appear
      await waitFor(() => {
        expect(getModal()).toBeInTheDocument();
      });
      expect(getModalRevertButton()).toBeInTheDocument();
      expect(getModalSeeActivityButton()).toBeInTheDocument();
    });

    it('should revert to old experience when confirming in modal', async () => {
      const { user } = renderRuleListPageTitle();

      await user.click(ui.revertButton.get());
      await waitFor(() => {
        expect(getModal()).toBeInTheDocument();
      });

      await user.click(getModalRevertButton());

      expect(getPreviewToggle('alertingListViewV2')).toBe(false);
      expect(mockReload).toHaveBeenCalled();
    });

    it('should close modal when clicking "See Alert Activity"', async () => {
      const { user } = renderRuleListPageTitle();

      await user.click(ui.revertButton.get());
      await waitFor(() => {
        expect(getModal()).toBeInTheDocument();
      });

      await user.click(getModalSeeActivityButton());

      // Modal should close
      await waitFor(() => {
        expect(queryModal()).not.toBeInTheDocument();
      });

      // Should NOT switch view
      expect(mockReload).not.toHaveBeenCalled();
    });

    it('should close modal when dismissed via escape', async () => {
      const { user } = renderRuleListPageTitle();

      await user.click(ui.revertButton.get());
      await waitFor(() => {
        expect(getModal()).toBeInTheDocument();
      });

      // Press escape to close
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(queryModal()).not.toBeInTheDocument();
      });
    });
  });
});
