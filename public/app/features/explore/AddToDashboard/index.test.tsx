import React, { ReactNode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { configureStore } from 'app/store/configureStore';
import { ExploreId } from 'app/types';
import { Provider } from 'react-redux';
import { AddToDashboard } from '.';
import userEvent from '@testing-library/user-event';
import * as api from './addToDashboard';
import { locationService } from '@grafana/runtime';

const setup = (children: ReactNode) => {
  const store = configureStore();

  return render(<Provider store={store}>{children}</Provider>);
};

const openModal = async () => {
  userEvent.click(screen.getByRole('button', { name: /add to dashboard/i }));

  expect(await screen.findByRole('dialog', { name: 'Add panel to dashboard' })).toBeInTheDocument();
};

describe('AddToDashboardButton', () => {
  const addToDashboardResponse = Promise.resolve();

  const waitForAddToDashboardResponse = async () => {
    return act(async () => {
      await addToDashboardResponse;
    });
  };

  beforeEach(() => {
    jest.spyOn(api, 'addPanelToDashboard').mockReturnValue(addToDashboardResponse);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Opens and closes the modal correctly', async () => {
    setup(<AddToDashboard exploreId={ExploreId.left} />);

    await openModal();

    userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('navigation', () => {
    it('Navigates to dashboard when clicking on "Open"', async () => {
      locationService.push = jest.fn();
      global.open = jest.fn();

      setup(<AddToDashboard exploreId={ExploreId.left} />);

      await openModal();

      userEvent.click(screen.getByRole('button', { name: /open$/i }));

      await waitForAddToDashboardResponse();

      expect(screen.queryByRole('dialog', { name: 'Add panel to dashboard' })).not.toBeInTheDocument();

      expect(locationService.push).toHaveBeenCalled();
      expect(global.open).not.toHaveBeenCalled();
    });

    it('Navigates to dashboard in a new tab when clicking on "Open in a new tab"', async () => {
      locationService.push = jest.fn();
      global.open = jest.fn();

      setup(<AddToDashboard exploreId={ExploreId.left} />);

      await openModal();

      userEvent.click(screen.getByRole('button', { name: /open in new tab/i }));

      await waitForAddToDashboardResponse();

      expect(screen.queryByRole('dialog', { name: 'Add panel to dashboard' })).not.toBeInTheDocument();

      expect(global.open).toHaveBeenCalledWith(expect.anything(), '_blank');
      expect(locationService.push).not.toHaveBeenCalled();
    });
  });

  describe('Save to new dashboard', () => {
    describe('Navigate to correct dashboard when saving', () => {
      it('Opens the new dashboard in a new tab', async () => {
        global.open = jest.fn();

        setup(<AddToDashboard exploreId={ExploreId.left} />);

        await openModal();

        userEvent.click(screen.getByRole('button', { name: /open in new tab/i }));

        await waitForAddToDashboardResponse();

        expect(screen.queryByRole('dialog', { name: 'Add panel to dashboard' })).not.toBeInTheDocument();

        expect(global.open).toHaveBeenCalledWith('dashboard/new', '_blank');
      });

      it('Navigates to the new dashboard', async () => {
        locationService.push = jest.fn();

        setup(<AddToDashboard exploreId={ExploreId.left} />);

        await openModal();

        userEvent.click(screen.getByRole('button', { name: /open$/i }));

        await waitForAddToDashboardResponse();

        expect(screen.queryByRole('dialog', { name: 'Add panel to dashboard' })).not.toBeInTheDocument();

        expect(locationService.push).toHaveBeenCalledWith('dashboard/new');
      });
    });
  });

  describe('Save to existing dashboard', () => {
    it('Renders the dashboard picker when switching to "Existing Dashboard"', async () => {
      setup(<AddToDashboard exploreId={ExploreId.left} />);

      await openModal();

      expect(screen.queryByRole('combobox', { name: /dashboard/ })).not.toBeInTheDocument();

      userEvent.click(screen.getByRole<HTMLInputElement>('radio', { name: /existing dashboard/i }));
      expect(screen.getByRole('combobox', { name: /dashboard/ })).toBeInTheDocument();
    });

    it('Does not submit if no dashboard is selected', async () => {
      locationService.push = jest.fn();

      setup(<AddToDashboard exploreId={ExploreId.left} />);

      await openModal();

      userEvent.click(screen.getByRole<HTMLInputElement>('radio', { name: /existing dashboard/i }));

      userEvent.click(screen.getByRole('button', { name: /open$/i }));
      await waitForAddToDashboardResponse();

      expect(locationService.push).not.toHaveBeenCalled();
    });

    describe('Navigate to correct dashboard when saving', () => {
      it('Opens the selected dashboard in a new tab', async () => {
        // TODO: implement
      });

      it('Navigates to the selected dashboard', async () => {
        // TODO: implement
      });
    });
  });
});
