import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';

import { locationUtil } from '@grafana/data';
import { config, setLocationService } from '@grafana/runtime';

import TestProvider from '../../../../test/helpers/TestProvider';

// Need to mock createBrowserHistory here to avoid errors
jest.mock('history', () => ({
  ...jest.requireActual('history'),
  createBrowserHistory: () => ({
    listen: jest.fn(),
    location: {},
    createHref: jest.fn(),
  }),
}));

import NavBarItem, { Props } from './NavBarItem';
import { NavBarContext } from './context';

const onClickMock = jest.fn();
const setMenuIdOpenMock = jest.fn();
const defaults: Props = {
  link: {
    text: 'Parent Node',
    onClick: onClickMock,
    children: [
      { text: 'Child Node 1', onClick: onClickMock, children: [] },
      { text: 'Child Node 2', onClick: onClickMock, children: [] },
    ],
    id: 'MY_NAV_ID',
  },
};

async function getTestContext(overrides: Partial<Props> = {}, subUrl = '', isMenuOpen = false) {
  jest.clearAllMocks();
  config.appSubUrl = subUrl;
  locationUtil.initialize({ config, getTimeRangeForUrl: jest.fn(), getVariablesUrlParams: jest.fn() });
  const pushMock = jest.fn();
  const locationService: any = { push: pushMock };
  setLocationService(locationService);
  const props = { ...defaults, ...overrides };

  const { rerender } = render(
    <TestProvider>
      <BrowserRouter>
        <NavBarContext.Provider
          value={{
            menuIdOpen: isMenuOpen ? props.link.id : undefined,
            setMenuIdOpen: setMenuIdOpenMock,
          }}
        >
          <NavBarItem {...props} />
        </NavBarContext.Provider>
      </BrowserRouter>
    </TestProvider>
  );

  // Need to click this first to set the correct selection range
  // see https://github.com/testing-library/user-event/issues/901#issuecomment-1087192424
  await userEvent.click(document.body);
  return { rerender, pushMock };
}

describe('NavBarItem', () => {
  describe('when url property is not set', () => {
    it('then it renders the menu trigger as a button', async () => {
      await getTestContext();

      expect(screen.getAllByRole('button')).toHaveLength(1);
    });

    describe('and clicking on the menu trigger button', () => {
      it('then the onClick handler should be called', async () => {
        await getTestContext();

        await userEvent.click(screen.getByRole('button'));
        expect(onClickMock).toHaveBeenCalledTimes(1);
      });
    });

    describe('and hovering over the menu trigger button', () => {
      it('then the menuIdOpen should be set correctly', async () => {
        await getTestContext();

        await userEvent.hover(screen.getByRole('button'));
        expect(setMenuIdOpenMock).toHaveBeenCalledWith(defaults.link.id);
      });
    });

    describe('and tabbing to the menu trigger button', () => {
      it('then the menuIdOpen should be set correctly', async () => {
        await getTestContext();

        await userEvent.tab();
        expect(setMenuIdOpenMock).toHaveBeenCalledWith(defaults.link.id);
      });
    });

    it('shows the menu when the correct menuIdOpen is set', async () => {
      await getTestContext(undefined, undefined, true);

      expect(screen.getByText('Parent Node')).toBeInTheDocument();
      expect(screen.getByText('Child Node 1')).toBeInTheDocument();
      expect(screen.getByText('Child Node 2')).toBeInTheDocument();
    });

    describe('and pressing arrow right on the menu trigger button', () => {
      it('then the correct menu item should receive focus', async () => {
        await getTestContext(undefined, undefined, true);

        await userEvent.tab();
        expect(screen.getAllByRole('menuitem')).toHaveLength(3);
        expect(screen.getByRole('menuitem', { name: 'Parent Node' })).toHaveAttribute('tabIndex', '-1');
        expect(screen.getAllByRole('menuitem')[1]).toHaveAttribute('tabIndex', '-1');
        expect(screen.getAllByRole('menuitem')[2]).toHaveAttribute('tabIndex', '-1');

        await userEvent.keyboard('{ArrowRight}');
        expect(screen.getAllByRole('menuitem')).toHaveLength(3);
        expect(screen.getAllByRole('menuitem')[0]).toHaveAttribute('tabIndex', '0');
        expect(screen.getAllByRole('menuitem')[1]).toHaveAttribute('tabIndex', '-1');
        expect(screen.getAllByRole('menuitem')[2]).toHaveAttribute('tabIndex', '-1');
      });
    });
  });

  describe('when url property is set', () => {
    it('then it renders the menu trigger as a link', async () => {
      await getTestContext({ link: { ...defaults.link, url: 'https://www.grafana.com' } });

      expect(screen.getAllByRole('link')).toHaveLength(1);
      expect(screen.getByRole('link')).toHaveAttribute('href', 'https://www.grafana.com');
    });

    describe('and hovering over the menu trigger link', () => {
      it('sets the correct menuIdOpen', async () => {
        await getTestContext({ link: { ...defaults.link, url: 'https://www.grafana.com' } });

        await userEvent.hover(screen.getByRole('link'));

        expect(setMenuIdOpenMock).toHaveBeenCalledWith(defaults.link.id);
      });
    });

    describe('and tabbing to the menu trigger link', () => {
      it('sets the correct menuIdOpen', async () => {
        await getTestContext({ link: { ...defaults.link, url: 'https://www.grafana.com' } });

        await userEvent.tab();

        expect(setMenuIdOpenMock).toHaveBeenCalledWith(defaults.link.id);
      });
    });

    it('shows the menu when the correct menuIdOpen is set', async () => {
      await getTestContext({ link: { ...defaults.link, url: 'https://www.grafana.com' } }, undefined, true);

      expect(screen.getByText('Parent Node')).toBeInTheDocument();
      expect(screen.getByText('Child Node 1')).toBeInTheDocument();
      expect(screen.getByText('Child Node 2')).toBeInTheDocument();
    });

    describe('and pressing arrow right on the menu trigger link', () => {
      it('then the correct menu item should receive focus', async () => {
        await getTestContext({ link: { ...defaults.link, url: 'https://www.grafana.com' } }, undefined, true);

        await userEvent.tab();
        expect(screen.getAllByRole('link')[0]).toHaveFocus();
        expect(screen.getAllByRole('menuitem')).toHaveLength(3);
        expect(screen.getAllByRole('menuitem')[0]).toHaveAttribute('tabIndex', '-1');
        expect(screen.getAllByRole('menuitem')[1]).toHaveAttribute('tabIndex', '-1');
        expect(screen.getAllByRole('menuitem')[2]).toHaveAttribute('tabIndex', '-1');

        await userEvent.keyboard('{ArrowRight}');
        expect(screen.getAllByRole('link')[0]).not.toHaveFocus();
        expect(screen.getAllByRole('menuitem')).toHaveLength(3);
        expect(screen.getAllByRole('menuitem')[0]).toHaveAttribute('tabIndex', '0');
        expect(screen.getAllByRole('menuitem')[1]).toHaveAttribute('tabIndex', '-1');
        expect(screen.getAllByRole('menuitem')[2]).toHaveAttribute('tabIndex', '-1');
      });
    });

    describe('and pressing arrow left on a menu item', () => {
      it('then the nav bar item should receive focus', async () => {
        await getTestContext({ link: { ...defaults.link, url: 'https://www.grafana.com' } }, undefined, true);

        await userEvent.tab();
        await userEvent.keyboard('{ArrowRight}');
        expect(screen.getAllByRole('link')[0]).not.toHaveFocus();
        expect(screen.getAllByRole('menuitem')).toHaveLength(3);
        expect(screen.getAllByRole('menuitem')[0]).toHaveAttribute('tabIndex', '0');
        expect(screen.getAllByRole('menuitem')[1]).toHaveAttribute('tabIndex', '-1');
        expect(screen.getAllByRole('menuitem')[2]).toHaveAttribute('tabIndex', '-1');

        await userEvent.keyboard('{ArrowLeft}');
        expect(screen.getAllByRole('link')[0]).toHaveFocus();
        expect(screen.getAllByRole('menuitem')).toHaveLength(3);
        expect(screen.getAllByRole('menuitem')[0]).toHaveAttribute('tabIndex', '-1');
        expect(screen.getAllByRole('menuitem')[1]).toHaveAttribute('tabIndex', '-1');
        expect(screen.getAllByRole('menuitem')[2]).toHaveAttribute('tabIndex', '-1');
      });
    });

    describe('when appSubUrl is configured and user clicks on menuitem link', () => {
      it('then location service should be called with correct url', async () => {
        const { pushMock } = await getTestContext(
          {
            link: {
              ...defaults.link,
              url: 'https://www.grafana.com',
              children: [{ text: 'New', url: '/grafana/dashboard/new', children: [] }],
            },
          },
          '/grafana',
          true
        );

        await userEvent.click(screen.getByText('New'));
        await waitFor(() => {
          expect(pushMock).toHaveBeenCalledTimes(1);
          expect(pushMock).toHaveBeenCalledWith('/dashboard/new');
        });
      });
    });

    describe('when appSubUrl is not configured and user clicks on menuitem link', () => {
      it('then location service should be called with correct url', async () => {
        const { pushMock } = await getTestContext(
          {
            link: {
              ...defaults.link,
              url: 'https://www.grafana.com',
              children: [{ text: 'New', url: '/grafana/dashboard/new', children: [] }],
            },
          },
          undefined,
          true
        );

        await userEvent.click(screen.getByText('New'));
        await waitFor(() => {
          expect(pushMock).toHaveBeenCalledTimes(1);
          expect(pushMock).toHaveBeenCalledWith('/grafana/dashboard/new');
        });
      });
    });
  });
});
