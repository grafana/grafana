import { render, screen } from 'test/test-utils';

import { contextSrv } from 'app/core/services/context_srv';

import { MegaMenuItemText, type Props } from './MegaMenuItemText';

const renderItemText = (props: Partial<Props> = {}) =>
  render(
    <MegaMenuItemText url="/explore" itemName="Explore & Test" onPin={() => {}} isPinned={false} {...props}>
      <span>Explore & Test</span>
    </MegaMenuItemText>
  );

describe('MegaMenuItemText', () => {
  beforeEach(() => {
    contextSrv.isSignedIn = true;
  });

  afterEach(() => {
    contextSrv.isSignedIn = false;
  });

  it.each([
    { navigationInfoArchRefresh: false, isPinned: false, label: 'Bookmark Explore & Test', icon: 'bookmark' },
    { navigationInfoArchRefresh: true, isPinned: false, label: 'Pin Explore & Test', icon: 'gf-pin-unfilled' },
    { navigationInfoArchRefresh: true, isPinned: true, label: 'Unpin Explore & Test', icon: 'gf-pin-filled' },
  ])('uses $label with unescaped tooltip text and the $icon icon', async ({ label, icon, ...props }) => {
    const onPin = jest.fn();
    const { user } = renderItemText({ ...props, onPin });
    const button = screen.getByLabelText(label);
    expect(screen.getByTestId(`icon-${icon}`)).toBeInTheDocument();
    await user.hover(button);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(label);
    await user.click(button);
    expect(onPin).toHaveBeenCalledWith('/explore');
  });

  it('keeps the pin control reachable from the link by keyboard', async () => {
    const onPin = jest.fn();
    const { user } = renderItemText({ navigationInfoArchRefresh: true, onPin });
    await user.tab();
    expect(screen.getByRole('link')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Pin Explore & Test')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onPin).toHaveBeenCalledWith('/explore');
  });

  it('keeps anonymous navigation available without pin controls', () => {
    contextSrv.isSignedIn = false;
    renderItemText({ navigationInfoArchRefresh: true });
    expect(screen.getByRole('link')).toHaveAttribute('href', '/explore');
    expect(screen.queryByLabelText('Pin Explore & Test')).not.toBeInTheDocument();
  });
});
