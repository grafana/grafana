import { render } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { reportInteraction } from '@grafana/runtime';

import { testWithFeatureToggles } from '../test/test-utils';

import { RuleListPageTitle } from './RuleListPageTitle';

// Constants
const featureTogglesKey = 'grafana.featureToggles';
const toggleName = 'alertingListViewV2';

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

// Helper function for rendering the component
function renderRuleListPageTitle() {
  // Mock localStorage
  const storage = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    clear: () => storage.clear(),
  };

  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
  });

  const view = render(<RuleListPageTitle title="Alert rules" />);

  return {
    ...view,
    storage,
  };
}

describe('RuleListPageTitle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      const { user, storage } = renderRuleListPageTitle();

      await user.click(ui.enableV2Button.get());

      expect(storage.get(featureTogglesKey)).toBe(`${toggleName}=true`);
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
      const { user, storage } = renderRuleListPageTitle();
      storage.set(featureTogglesKey, `${toggleName}=true`);

      await user.click(ui.disableV2Button.get());

      // When the toggle is set to undefined, it should be removed from localStorage
      expect(storage.get(featureTogglesKey)).toBe('');
      expect(mockReload).toHaveBeenCalled();
    });

    it('should report interaction when disabling v2', async () => {
      const { user, storage } = renderRuleListPageTitle();
      storage.set(featureTogglesKey, `${toggleName}=true`);

      await user.click(ui.disableV2Button.get());

      expect(reportInteraction).toHaveBeenCalledWith('alerting.list_view.v2.disabled');
    });
  });
});
