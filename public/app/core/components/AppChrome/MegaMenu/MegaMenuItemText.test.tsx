import { render, screen } from 'test/test-utils';

import { contextSrv } from 'app/core/services/context_srv';

import { MegaMenuItemText, type Props } from './MegaMenuItemText';

const renderItemText = (props: Partial<Props> = {}) => {
  return render(
    <MegaMenuItemText
      url="/explore"
      itemName="Explore"
      onPin={() => {}}
      isPinned={false}
      canCustomise={false}
      editMode={false}
      isHideable={false}
      isHidden={false}
      onToggleHidden={() => {}}
      {...props}
    >
      <span>Explore & Test</span>
    </MegaMenuItemText>
  );
};

describe('MegaMenuItemText', () => {
  beforeEach(() => {
    contextSrv.isSignedIn = true;
  });

  afterEach(() => {
    contextSrv.isSignedIn = false;
  });

  it('keeps ampersands unescaped in the legacy bookmark tooltip', async () => {
    const { user } = renderItemText({ itemName: 'Explore & Test', canCustomise: false });

    await user.hover(screen.getByLabelText('Bookmark Explore & Test'));
    const tooltip = await screen.findByRole('tooltip');

    expect(tooltip).toHaveTextContent('Bookmark Explore & Test');
    expect(tooltip).not.toHaveTextContent('Bookmark Explore &amp; Test');
  });

  it('keeps ampersands unescaped in pin and hide tooltips when customising an unpinned visible item', async () => {
    const { user } = renderItemText({
      itemName: 'Explore & Test',
      canCustomise: true,
      editMode: true,
      isPinned: false,
      isHideable: true,
      isHidden: false,
    });

    await user.hover(screen.getByLabelText('Pin Explore & Test'));
    const pinTooltip = await screen.findByRole('tooltip');
    expect(pinTooltip).toHaveTextContent('Pin Explore & Test');
    expect(pinTooltip).not.toHaveTextContent('Pin Explore &amp; Test');

    await user.hover(screen.getByLabelText('Hide Explore & Test'));
    const hideTooltip = await screen.findByRole('tooltip');
    expect(hideTooltip).toHaveTextContent('Hide Explore & Test');
    expect(hideTooltip).not.toHaveTextContent('Hide Explore &amp; Test');
  });

  it('keeps ampersands unescaped in unpin and show tooltips when customising a pinned hidden item', async () => {
    const { user } = renderItemText({
      itemName: 'Explore & Test',
      canCustomise: true,
      editMode: true,
      isPinned: true,
      isHideable: true,
      isHidden: true,
    });

    await user.hover(screen.getByLabelText('Unpin Explore & Test'));
    const unpinTooltip = await screen.findByRole('tooltip');
    expect(unpinTooltip).toHaveTextContent('Unpin Explore & Test');
    expect(unpinTooltip).not.toHaveTextContent('Unpin Explore &amp; Test');

    await user.hover(screen.getByLabelText('Show Explore & Test'));
    const showTooltip = await screen.findByRole('tooltip');
    expect(showTooltip).toHaveTextContent('Show Explore & Test');
    expect(showTooltip).not.toHaveTextContent('Show Explore &amp; Test');
  });
});
