import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';

import { DataLinksContextMenu } from './DataLinksContextMenu';

const twoLinks = () => [
  { href: '/link1', title: 'Link1', target: '_blank' as const, origin: {} },
  { href: '/link2', title: 'Link2', target: '_blank' as const, origin: {} },
];

const singleLink = () => [{ href: '/link1', title: 'Link1', target: '_blank' as const, origin: {} }];

describe('DataLinksContextMenu', () => {
  it('passes openMenu and targetClassName to children for multiple links', () => {
    const childrenSpy = jest.fn(() => <div aria-label="child" />);
    render(<DataLinksContextMenu links={twoLinks}>{childrenSpy}</DataLinksContextMenu>);

    expect(childrenSpy).toHaveBeenCalledWith(
      expect.objectContaining({ openMenu: expect.any(Function), targetClassName: expect.any(String) })
    );
    expect(screen.queryByTestId(selectors.components.DataLinksContextMenu.singleLink)).not.toBeInTheDocument();
  });

  it('opens context menu and renders menu items on click', async () => {
    render(
      <DataLinksContextMenu links={twoLinks}>
        {({ openMenu }) => <button aria-label="trigger" onClick={openMenu} />}
      </DataLinksContextMenu>
    );

    await userEvent.click(screen.getByLabelText('trigger'));

    expect(screen.getByText('Data links')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Link1' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Link2' })).toBeInTheDocument();
  });

  it('renders single link with correct attributes and style', () => {
    render(
      <DataLinksContextMenu links={singleLink} style={{ color: 'red' }}>
        {() => <div aria-label="child" />}
      </DataLinksContextMenu>
    );

    const link = screen.getByTestId(selectors.components.DataLinksContextMenu.singleLink);
    expect(link).toHaveAttribute('href', '/link1');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('title', 'Link1');
    expect(link).toHaveStyle({ color: 'red', overflow: 'hidden', display: 'flex' });
  });

  it('calls onClick on single link when clicked', async () => {
    const onClick = jest.fn();
    const linkWithClick = () => [{ href: '/link1', title: 'Link1', target: '_blank' as const, origin: {}, onClick }];

    render(<DataLinksContextMenu links={linkWithClick}>{() => <span>click me</span>}</DataLinksContextMenu>);

    await userEvent.click(screen.getByText('click me'));

    expect(onClick).toHaveBeenCalled();
  });
});
