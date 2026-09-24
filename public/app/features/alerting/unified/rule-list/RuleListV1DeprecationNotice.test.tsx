import { render, testWithFeatureToggles } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { getPreviewToggle, setPreviewToggle } from '../previewToggles';

import { RuleListV1DeprecationNotice } from './RuleListV1DeprecationNotice';

const mockReload = jest.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

const ui = {
  switchToNewListButton: byRole('button', { name: /switch to the new list/i }),
};

describe('RuleListV1DeprecationNotice', () => {
  testWithFeatureToggles({ enable: ['alertingListViewV2PreviewToggle'] });

  beforeEach(() => {
    mockReload.mockClear();
    setPreviewToggle('alertingListViewV2', false);
  });

  afterEach(() => {
    setPreviewToggle('alertingListViewV2', undefined);
  });

  it('stores the preference for the new list and reloads the page when switching', async () => {
    const { user } = render(<RuleListV1DeprecationNotice />);

    await user.click(ui.switchToNewListButton.get());

    expect(getPreviewToggle('alertingListViewV2')).toBe(true);
    expect(mockReload).toHaveBeenCalledTimes(1);
  });
});
