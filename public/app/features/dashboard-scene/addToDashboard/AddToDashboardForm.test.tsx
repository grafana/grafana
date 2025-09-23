import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { locationService, setEchoSrv } from '@grafana/runtime';
import { defaultDashboard } from '@grafana/schema';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { Echo } from 'app/core/services/echo/Echo';
import store from 'app/core/store';
import { DashboardSearchItemType } from 'app/features/search/types';

import { AddToDashboardForm, Props } from './AddToDashboardForm';

async function setup(overrides: Partial<Props> = {}) {
  const props: Props = {
    buildPanel: () => ({ id: 1, type: 'table', options: { showHeader: false } }),
    onClose: jest.fn(),
    options: undefined,
    ...overrides,
  };

  const res = render(<AddToDashboardForm {...props} />);
  await act(() => Promise.resolve());
  return res;
}

jest.mock('app/core/services/context_srv');

const mocks = {
  contextSrv: jest.mocked(contextSrv),
};

describe('AddToDashboardButton', () => {
  beforeAll(() => {
    setEchoSrv(new Echo());
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(backendSrv, 'search').mockResolvedValue([]);
    mocks.contextSrv.hasPermission.mockImplementation(() => true);
    locationService.push('/');
  });

  describe('navigation', () => {
    it('Navigates to dashboard when clicking on "Open"', async () => {
      // @ts-expect-error global.open should return a Window, but is not implemented in js-dom.
      const openSpy = jest.spyOn(global, 'open').mockReturnValue(true);

      await setup();

      await userEvent.click(screen.getByRole('button', { name: /open dashboard$/i }));

      expect(screen.queryByRole('dialog', { name: 'Add panel to dashboard' })).not.toBeInTheDocument();

      expect(locationService.getLocation().pathname).toBe('/dashboard/new');
      expect(openSpy).not.toHaveBeenCalled();
    });

    it('Navigates to dashboard in a new tab when clicking on "Open in a new tab"', async () => {
      // @ts-expect-error global.open should return a Window, but is not implemented in js-dom.
      const openSpy = jest.spyOn(global, 'open').mockReturnValue(true);

      await setup();

      await userEvent.click(screen.getByRole('button', { name: /open in new tab/i }));

      expect(openSpy).toHaveBeenCalledWith(expect.anything(), '_blank');
      expect(locationService.getLocation().pathname).toBe('/');
    });
  });

  describe('Add to new dashboard', () => {
    describe('Navigate to correct dashboard when saving', () => {
      it('Navigates to the new dashboard', async () => {
        await setup();

        await userEvent.click(screen.getByRole('button', { name: /open dashboard$/i }));

        expect(screen.queryByRole('dialog', { name: 'Add panel to dashboard' })).not.toBeInTheDocument();
        expect(locationService.getLocation().pathname).toBe('/dashboard/new');
      });
    });
  });

  describe('Add to existing dashboard', () => {
    it('Renders the dashboard picker when switching to "Existing Dashboard"', async () => {
      await setup();

      expect(screen.queryByRole('combobox', { name: /dashboard/ })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole<HTMLInputElement>('radio', { name: /existing dashboard/i }));
      expect(screen.getByRole('combobox', { name: /dashboard/ })).toBeInTheDocument();
    });

    it('Does not submit if no dashboard is selected', async () => {
      locationService.push = jest.fn();

      await setup();

      await userEvent.click(screen.getByRole<HTMLInputElement>('radio', { name: /existing dashboard/i }));
      await userEvent.click(screen.getByRole('button', { name: /open dashboard$/i }));

      locationService.push = jest.fn();
      expect(locationService.push).not.toHaveBeenCalled();
    });

    describe('Navigate to correct dashboard when saving', () => {
      it('Opens the selected dashboard in a new tab', async () => {
        // @ts-expect-error global.open should return a Window, but is not implemented in js-dom.
        const openSpy = jest.spyOn(global, 'open').mockReturnValue(true);

        jest.spyOn(backendSrv, 'getDashboardByUid').mockResolvedValue({
          dashboard: { ...defaultDashboard, templating: { list: [] }, title: 'Dashboard Title', uid: 'someUid' },
          meta: {},
        });

        jest.spyOn(backendSrv, 'search').mockResolvedValue([
          {
            uid: 'someUid',
            isStarred: false,
            title: 'Dashboard Title',
            tags: [],
            type: DashboardSearchItemType.DashDB,
            uri: 'someUri',
            url: 'someUrl',
          },
        ]);

        await setup();

        await userEvent.click(screen.getByRole('radio', { name: /existing dashboard/i }));
        await userEvent.click(screen.getByRole('combobox', { name: /dashboard/i }));

        await waitFor(async () => {
          await screen.findByTestId(selectors.components.Select.option);
        });

        await userEvent.click(screen.getByTestId(selectors.components.Select.option));
        await userEvent.click(screen.getByRole('button', { name: /open in new tab/i }));

        await waitFor(async () => {
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        expect(openSpy).toBeCalledWith('d/someUid', '_blank');
      });

      it('Navigates to the selected dashboard', async () => {
        jest.spyOn(backendSrv, 'search').mockResolvedValue([
          {
            uid: 'someUid',
            isStarred: false,
            title: 'Dashboard Title',
            tags: [],
            type: DashboardSearchItemType.DashDB,
            uri: 'someUri',
            url: 'someUrl',
          },
        ]);

        await setup();

        await userEvent.click(screen.getByRole('radio', { name: /existing dashboard/i }));
        await userEvent.click(screen.getByRole('combobox', { name: /dashboard/i }));

        await waitFor(async () => {
          await screen.findByTestId(selectors.components.Select.option);
        });

        await userEvent.click(screen.getByTestId(selectors.components.Select.option));
        await userEvent.click(screen.getByRole('button', { name: /open dashboard$/i }));

        await waitFor(async () => {
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        expect(locationService.getLocation().pathname).toBe('/d/someUid');
      });
    });
  });
});

describe('Permissions', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Should only show existing dashboard option with no access to create', async () => {
    mocks.contextSrv.hasPermission.mockImplementation((action) => {
      if (action === 'dashboards:create') {
        return false;
      } else {
        return true;
      }
    });

    await setup();

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('Should only show new dashboard option with no access to write', async () => {
    mocks.contextSrv.hasPermission.mockImplementation((action) => {
      if (action === 'dashboards:write') {
        return false;
      } else {
        return true;
      }
    });

    await setup();

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
});

describe('Error handling', () => {
  beforeEach(() => {
    mocks.contextSrv.hasPermission.mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Shows an error if opening a new tab fails', async () => {
    jest.spyOn(global, 'open').mockReturnValue(null);
    const removeDashboardSpy = jest.spyOn(store, 'delete');

    await setup();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /open in new tab/i }));

    await waitFor(async () => {
      expect(await screen.findByRole('alert')).toBeInTheDocument();
    });

    expect(removeDashboardSpy).toHaveBeenCalled();
  });

  it('Shows an error if saving to localStorage fails', async () => {
    jest.spyOn(store, 'setObject').mockImplementation(() => {
      throw 'SOME ERROR';
    });

    await setup();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /open in new tab/i }));

    await waitFor(async () => {
      expect(await screen.findByRole('alert')).toBeInTheDocument();
    });
  });
});
