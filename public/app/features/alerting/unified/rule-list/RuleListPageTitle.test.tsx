import { render } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { reportInteraction } from '@grafana/runtime';

import { mockLocalStorage } from '../mocks';
import { getPreviewToggle, setPreviewToggle } from '../previewToggles';
import { testWithFeatureToggles } from '../test/test-utils';

import { RuleListPageTitle } from './RuleListPageTitle';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

// Mock window.location.reload
const mockReload = jest.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

const ui = {
  title: byRole('heading', { name: 'Alert rules' }),
  enableV2Button: byRole('button', { name: 'Try out the new look!' }),
  disableV2Button: byRole('button', { name: 'Go back to the old look' }),
};

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

  it('should not show v2 toggle when alertingListViewV2PreviewToggle feature flag is disabled', () => {
    renderRuleListPageTitle();
    expect(ui.enableV2Button.query()).not.toBeInTheDocument();
    expect(ui.disableV2Button.query()).not.toBeInTheDocument();
  });

  describe('with alertingListViewV2PreviewToggle enabled and alertingListViewV2 disabled', () => {
    testWithFeatureToggles(['alertingListViewV2PreviewToggle']);

    it('should show enable v2 button', () => {
      renderRuleListPageTitle();
      expect(ui.enableV2Button.get()).toBeInTheDocument();
      expect(ui.disableV2Button.query()).not.toBeInTheDocument();
      expect(ui.enableV2Button.get()).toHaveAttribute('data-testid', 'alerting-list-view-toggle-v2');
    });

    it('should enable v2 and reload page when clicked on "Try out the new look!" button', async () => {
      const { user } = renderRuleListPageTitle();

      await user.click(ui.enableV2Button.get());

      const previewToggle = getPreviewToggle('alertingListViewV2');
      expect(previewToggle).toBe(true);
      expect(mockReload).toHaveBeenCalled();
    });

    it('should report interaction when enabling v2', async () => {
      const { user } = renderRuleListPageTitle();

      await user.click(ui.enableV2Button.get());

      expect(reportInteraction).toHaveBeenCalledWith('alerting.list_view.v2.enabled');
    });
  });

  describe('with alertingListViewV2PreviewToggle enabled and alertingListViewV2 enabled', () => {
    testWithFeatureToggles(['alertingListViewV2PreviewToggle', 'alertingListViewV2']);

    it('should show disable v2 button', () => {
      renderRuleListPageTitle();
      expect(ui.disableV2Button.get()).toBeInTheDocument();
      expect(ui.enableV2Button.query()).not.toBeInTheDocument();
      expect(ui.disableV2Button.get()).toHaveAttribute('data-testid', 'alerting-list-view-toggle-v1');
    });

    it('should disable v2 and reload page when clicked on "Go back to the old look" button', async () => {
      setPreviewToggle('alertingListViewV2', true);
      const { user } = renderRuleListPageTitle();

      await user.click(ui.disableV2Button.get());

      expect(getPreviewToggle('alertingListViewV2')).toBe(false);
      expect(mockReload).toHaveBeenCalled();
    });

    it('should report interaction when disabling v2', async () => {
      setPreviewToggle('alertingListViewV2', true);
      const { user } = renderRuleListPageTitle();

      await user.click(ui.disableV2Button.get());

      expect(reportInteraction).toHaveBeenCalledWith('alerting.list_view.v2.disabled');
    });
  });
});
