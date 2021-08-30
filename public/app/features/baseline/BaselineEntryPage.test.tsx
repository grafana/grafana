import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Props, BaselineEntryPage } from './BaselineEntryPage';
import { initialBaselineEntryState } from './state/reducers';
import { backendSrv } from '../../core/services/backend_srv';

const defaultProps: Props = {
  ...initialBaselineEntryState,
  initBaselineEntryPage: jest.fn().mockResolvedValue(undefined),
  submitBaselineEntry: jest.fn().mockResolvedValue(undefined),
};

function getSelectors() {
  return {
    name: () => screen.getByRole('textbox', { name: /^name$/i }),
    email: () => screen.getByRole('textbox', { name: /email/i }),
    username: () => screen.getByRole('textbox', { name: /username/i }),
    submitBaselineEntry: () => screen.getByRole('button', { name: /edit user profile save button/i }),
  };
}

async function getTestContext(overrides: Partial<Props> = {}) {
  jest.clearAllMocks();
  const putSpy = jest.spyOn(backendSrv, 'put');
  const getSpy = jest
    .spyOn(backendSrv, 'get')
    .mockResolvedValue({ timezone: 'UTC', homeDashboardId: 0, theme: 'dark' });
  const searchSpy = jest.spyOn(backendSrv, 'search').mockResolvedValue([]);

  const props = { ...defaultProps, ...overrides };
  const { rerender } = render(<BaselineEntryPage {...props} />);

  // await waitFor(() => expect(props.initUserProfilePage).toHaveBeenCalledTimes(1));

  return { rerender, putSpy, getSpy, searchSpy, props };
}

describe('BaselineEntryPage', () => {
  describe('and user is edited and saved', () => {
    it('should call submitBaselineEntry', async () => {
      const { props } = await getTestContext();

      const { email, submitBaselineEntry } = getSelectors();
      userEvent.clear(email());
      await userEvent.type(email(), 'test@test.se');
      userEvent.click(submitBaselineEntry());

      await waitFor(() => expect(props.submitBaselineEntry).toHaveBeenCalledTimes(1));
      expect(props.submitBaselineEntry).toHaveBeenCalledWith({
        email: 'test@test.se',
        login: 'test',
        name: 'Test User',
      });
    });
  });
});
