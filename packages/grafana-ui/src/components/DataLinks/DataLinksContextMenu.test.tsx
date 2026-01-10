import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';

import { DataLinksContextMenu } from './DataLinksContextMenu';

const fakeAriaLabel = 'fake aria label';

describe('DataLinksContextMenu', () => {
  it('renders context menu when there are more than one data links', () => {
    render(
      <DataLinksContextMenu
        links={() => [
          {
            href: '/link1',
            title: 'Link1',
            target: '_blank',
            origin: {},
          },
          {
            href: '/link2',
            title: 'Link2',
            target: '_blank',
            origin: {},
          },
        ]}
      >
        {() => <div aria-label={fakeAriaLabel} />}
      </DataLinksContextMenu>
    );

    expect(screen.getByLabelText(fakeAriaLabel)).toBeInTheDocument();
    expect(screen.queryAllByLabelText(selectors.components.DataLinksContextMenu.singleLink)).toHaveLength(0);
  });

  it('renders link when there is a single data link', () => {
    render(
      <DataLinksContextMenu
        links={() => [
          {
            href: '/link1',
            title: 'Link1',
            target: '_blank',
            origin: {},
          },
        ]}
      >
        {() => <div aria-label={fakeAriaLabel} />}
      </DataLinksContextMenu>
    );

    expect(screen.getByLabelText(fakeAriaLabel)).toBeInTheDocument();
    expect(screen.getByTestId(selectors.components.DataLinksContextMenu.singleLink)).toBeInTheDocument();
  });

  it('does not render anything when there are no data links', () => {
    render(<DataLinksContextMenu links={() => []}>{() => <div aria-label={fakeAriaLabel} />}</DataLinksContextMenu>);

    expect(screen.getByLabelText(fakeAriaLabel)).toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.DataLinksContextMenu.singleLink)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(selectors.components.Menu.MenuComponent('Context'))).not.toBeInTheDocument();
  });

  describe('openMenu function', () => {
    it('accepts mouse event', async () => {
      render(
        <DataLinksContextMenu
          links={() => [
            {
              href: '/link1',
              title: 'Link1',
              target: '_blank',
              origin: {},
            },
            {
              href: '/link2',
              title: 'Link2',
              target: '_blank',
              origin: {},
            },
          ]}
        >
          {({ openMenu }) => <div aria-label={fakeAriaLabel} onClick={openMenu} />}
        </DataLinksContextMenu>
      );

      await userEvent.click(screen.getByLabelText(fakeAriaLabel));

      expect(screen.getByLabelText(selectors.components.Menu.MenuComponent('Context'))).toBeInTheDocument();
    });

    it('accepts keyboard event', async () => {
      render(
        <DataLinksContextMenu
          links={() => [
            {
              href: '/link1',
              title: 'Link1',
              target: '_blank',
              origin: {},
            },
            {
              href: '/link2',
              title: 'Link2',
              target: '_blank',
              origin: {},
            },
          ]}
        >
          {({ openMenu }) => <div tabIndex={0} aria-label={fakeAriaLabel} onKeyDown={openMenu} />}
        </DataLinksContextMenu>
      );

      await userEvent.click(screen.getByLabelText(fakeAriaLabel));
      await userEvent.keyboard('Enter');

      expect(screen.getByLabelText(selectors.components.Menu.MenuComponent('Context'))).toBeInTheDocument();
    });
  });
});
