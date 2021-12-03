import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import NavBarItem, { Props } from './NavBarItem';
import userEvent from '@testing-library/user-event';

const onClickMock = jest.fn();
const defaults: Props = {
  children: undefined,
  link: {
    text: 'Parent Node',
    onClick: onClickMock,
    children: [
      { text: 'Child Node 1', onClick: onClickMock, children: [] },
      { text: 'Child Node 2', onClick: onClickMock, children: [] },
    ],
  },
};

function getTestContext(overrides: Partial<Props> = {}) {
  jest.clearAllMocks();
  const props = { ...defaults, ...overrides };

  const { rerender } = render(
    <BrowserRouter>
      <NavBarItem {...props}>{props.children}</NavBarItem>
    </BrowserRouter>
  );

  return { rerender };
}

describe('NavBarItem', () => {
  describe('when url property is not set', () => {
    it('then it renders the menu trigger as a button', () => {
      getTestContext();

      expect(screen.getAllByRole('button')).toHaveLength(1);
    });

    describe('and clicking on the menu trigger button', () => {
      it('then the onClick handler should be called', () => {
        getTestContext();

        userEvent.click(screen.getByRole('button'));

        expect(onClickMock).toHaveBeenCalledTimes(1);
      });
    });

    describe('and hovering over the menu trigger button', () => {
      it('then the menu items should be visible', () => {
        getTestContext();

        userEvent.hover(screen.getByRole('button'));

        expect(screen.getByRole('menuitem', { name: 'Parent Node' })).toBeInTheDocument();
        expect(screen.getByText('Child Node 1')).toBeInTheDocument();
        expect(screen.getByText('Child Node 2')).toBeInTheDocument();
      });
    });

    describe('and tabbing to the menu trigger button', () => {
      it('then the menu items should be visible', () => {
        getTestContext();

        userEvent.tab();

        expect(screen.getByText('Parent Node')).toBeInTheDocument();
        expect(screen.getByText('Child Node 1')).toBeInTheDocument();
        expect(screen.getByText('Child Node 2')).toBeInTheDocument();
      });
    });

    describe('and pressing arrow right on the menu trigger button', () => {
      it('then the correct menu item should receive focus', () => {
        getTestContext();

        userEvent.tab();
        expect(screen.getAllByRole('menuitem')).toHaveLength(3);
        expect(screen.getByRole('menuitem', { name: 'Parent Node' })).toHaveAttribute('tabIndex', '-1');
        expect(screen.getAllByRole('menuitem')[1]).toHaveAttribute('tabIndex', '-1');
        expect(screen.getAllByRole('menuitem')[2]).toHaveAttribute('tabIndex', '-1');

        userEvent.keyboard('{arrowright}');
        expect(screen.getAllByRole('menuitem')).toHaveLength(3);
        expect(screen.getAllByRole('menuitem')[0]).toHaveAttribute('tabIndex', '0');
        expect(screen.getAllByRole('menuitem')[1]).toHaveAttribute('tabIndex', '-1');
        expect(screen.getAllByRole('menuitem')[2]).toHaveAttribute('tabIndex', '-1');
      });
    });
  });

  describe('when url property is set', () => {
    it('then it renders the menu trigger as a link', () => {
      getTestContext({ link: { ...defaults.link, url: 'https://www.grafana.com' } });

      expect(screen.getAllByRole('link')).toHaveLength(1);
      expect(screen.getByRole('link')).toHaveAttribute('href', 'https://www.grafana.com');
    });

    describe('and hovering over the menu trigger link', () => {
      it('then the menu items should be visible', () => {
        getTestContext({ link: { ...defaults.link, url: 'https://www.grafana.com' } });

        userEvent.hover(screen.getByRole('link'));

        expect(screen.getByText('Parent Node')).toBeInTheDocument();
        expect(screen.getByText('Child Node 1')).toBeInTheDocument();
        expect(screen.getByText('Child Node 2')).toBeInTheDocument();
      });
    });

    describe('and tabbing to the menu trigger link', () => {
      it('then the menu items should be visible', () => {
        getTestContext({ link: { ...defaults.link, url: 'https://www.grafana.com' } });

        userEvent.tab();

        expect(screen.getByText('Parent Node')).toBeInTheDocument();
        expect(screen.getByText('Child Node 1')).toBeInTheDocument();
        expect(screen.getByText('Child Node 2')).toBeInTheDocument();
      });
    });

    describe('and pressing arrow right on the menu trigger link', () => {
      it('then the correct menu item should receive focus', () => {
        getTestContext({ link: { ...defaults.link, url: 'https://www.grafana.com' } });

        userEvent.tab();
        expect(screen.getAllByRole('menuitem')).toHaveLength(3);
        expect(screen.getAllByRole('menuitem')[0]).toHaveAttribute('tabIndex', '-1');
        expect(screen.getAllByRole('menuitem')[1]).toHaveAttribute('tabIndex', '-1');
        expect(screen.getAllByRole('menuitem')[2]).toHaveAttribute('tabIndex', '-1');

        userEvent.keyboard('{arrowright}');
        expect(screen.getAllByRole('menuitem')).toHaveLength(3);
        expect(screen.getAllByRole('menuitem')[0]).toHaveAttribute('tabIndex', '0');
        expect(screen.getAllByRole('menuitem')[1]).toHaveAttribute('tabIndex', '-1');
        expect(screen.getAllByRole('menuitem')[2]).toHaveAttribute('tabIndex', '-1');
      });
    });
  });
});
