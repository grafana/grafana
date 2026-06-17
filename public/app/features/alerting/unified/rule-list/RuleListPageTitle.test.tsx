import { render, testWithFeatureToggles, waitFor, within } from 'test/test-utils';
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
  modal: {
    dialog: byRole('dialog'),
  },
};

// Helper to get elements scoped within the modal dialog
function withinModal() {
  return within(ui.modal.dialog.get());
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

  describe('when alertingListViewV2PreviewToggle is enabled', () => {
    testWithFeatureToggles({ enable: ['alertingListViewV2PreviewToggle', 'alertingListViewV2'] });

    beforeEach(() => {
      setPreviewToggle('alertingListViewV2', true);
    });

    it('should show the revert toggle button', () => {
      renderRuleListPageTitle();
      expect(ui.revertButton.get()).toBeInTheDocument();
    });
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
      expect(ui.modal.dialog.query()).not.toBeInTheDocument();

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

    describe('when alertingTriage is disabled', () => {
      it('should revert directly without showing a modal', async () => {
        const { user } = renderRuleListPageTitle();

        await user.click(ui.revertButton.get());

        expect(ui.modal.dialog.query()).not.toBeInTheDocument();
        expect(getPreviewToggle('alertingListViewV2')).toBe(false);
        expect(mockReload).toHaveBeenCalled();
      });
    });

    describe('when alertingTriage is enabled', () => {
      testWithFeatureToggles({ enable: ['alertingListViewV2PreviewToggle', 'alertingListViewV2', 'alertingTriage'] });

      it('should show confirmation modal when clicking revert button', async () => {
        const { user } = renderRuleListPageTitle();

        await user.click(ui.revertButton.get());

        await waitFor(() => {
          expect(ui.modal.dialog.get()).toBeInTheDocument();
        });
        expect(withinModal().getByRole('button', { name: /revert to previous experience/i })).toBeInTheDocument();
        expect(withinModal().getByRole('button', { name: /see alert activity/i })).toBeInTheDocument();
      });

      it('should revert to old experience when confirming in modal', async () => {
        const { user } = renderRuleListPageTitle();

        await user.click(ui.revertButton.get());
        await waitFor(() => {
          expect(ui.modal.dialog.get()).toBeInTheDocument();
        });

        await user.click(withinModal().getByRole('button', { name: /revert to previous experience/i }));

        expect(getPreviewToggle('alertingListViewV2')).toBe(false);
        expect(mockReload).toHaveBeenCalled();
      });

      it('should close modal when clicking "See Alert Activity"', async () => {
        const { user } = renderRuleListPageTitle();

        await user.click(ui.revertButton.get());
        await waitFor(() => {
          expect(ui.modal.dialog.get()).toBeInTheDocument();
        });

        await user.click(withinModal().getByRole('button', { name: /see alert activity/i }));

        await waitFor(() => {
          expect(ui.modal.dialog.query()).not.toBeInTheDocument();
        });

        // Should NOT switch view
        expect(mockReload).not.toHaveBeenCalled();
      });

      it('should close modal when dismissed via escape', async () => {
        const { user } = renderRuleListPageTitle();

        await user.click(ui.revertButton.get());
        await waitFor(() => {
          expect(ui.modal.dialog.get()).toBeInTheDocument();
        });

        await user.keyboard('{Escape}');

        await waitFor(() => {
          expect(ui.modal.dialog.query()).not.toBeInTheDocument();
        });
      });
    });
  });
});
