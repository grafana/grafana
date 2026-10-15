import { act, render, screen } from 'test/test-utils';

import { UserListAdminPageContent } from './UserListAdminPage';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    get: jest.fn().mockResolvedValue({ users: [], perPage: 50, page: 0, totalCount: 0 }),
  }),
}));

jest.mock('./EnterpriseAuthFeaturesCard', () => ({
  EnterpriseAuthFeaturesCard: () => null,
}));

const loadedState = {
  userListAdmin: {
    users: [],
    query: '',
    page: 0,
    perPage: 50,
    totalPages: 1,
    showPaging: false,
    filters: [{ name: 'activeLast30Days', value: false }],
    isLoading: false,
  },
};

describe('UserListAdminPage', () => {
  it('keeps the status filter at its content width while the search field takes the remaining space', async () => {
    render(<UserListAdminPageContent />, { preloadedState: loadedState });
    await act(async () => {
      await Promise.resolve();
    });

    const allUsers = screen.getByRole('radio', { name: 'All users' });
    const active = screen.getByRole('radio', { name: 'Active last 30 days' });
    const filter = allUsers.closest('[role="radiogroup"]')?.parentElement;
    const search = screen.getByTestId('input-wrapper').parentElement;

    expect(allUsers).toBeChecked();
    expect(active).not.toBeChecked();
    expect(filter).toBe(active.closest('[role="radiogroup"]')?.parentElement);

    const filterStyle = getComputedStyle(filter!);
    expect(filterStyle.flexGrow).toBe('0');
    expect(filterStyle.flexShrink).toBe('0');
    expect(filterStyle.minWidth).toBe('max-content');

    const searchStyle = getComputedStyle(search!);
    expect(searchStyle.flexGrow).toBe('1');
    expect(searchStyle.flexShrink).toBe('1');
    expect(searchStyle.minWidth).toBe('160px');
  });

  it('filters to users active in the last 30 days', async () => {
    const { user, store } = render(<UserListAdminPageContent />, { preloadedState: loadedState });

    await user.click(screen.getByRole('radio', { name: 'Active last 30 days' }));

    expect(store?.getState().userListAdmin.filters).toEqual([{ name: 'activeLast30Days', value: true }]);
    expect(screen.getByRole('radio', { name: 'Active last 30 days' })).toBeChecked();
  });
});
