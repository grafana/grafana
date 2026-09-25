import { render, screen } from 'test/test-utils';

import { MegaMenuItemText, type Props } from './MegaMenuItemText';

const renderItemText = (props: Partial<Props> = {}) => {
  return render(
    <MegaMenuItemText url="/explore" itemName="Explore" editMode={false} isCustomizable={false} isHidden={false} {...props}>
      <span>Explore & Test</span>
    </MegaMenuItemText>
  );
};

describe('MegaMenuItemText', () => {
  it('does not show customisation controls outside edit mode', () => {
    renderItemText({ isCustomizable: true, editMode: false });
    expect(screen.queryByLabelText(/Hide|Show|Rename|Move/)).not.toBeInTheDocument();
  });

  it('does not show customisation controls for non-customisable items even while editing', () => {
    renderItemText({ isCustomizable: false, editMode: true });
    expect(screen.queryByLabelText(/Hide|Show|Rename|Move/)).not.toBeInTheDocument();
  });

  it('keeps ampersands unescaped in the move/rename/hide tooltips while editing a customisable item', async () => {
    const { user } = renderItemText({
      itemName: 'Explore & Test',
      editMode: true,
      isCustomizable: true,
      isHidden: false,
      canMoveUp: true,
      canMoveDown: true,
    });

    await user.hover(screen.getByLabelText('Move Explore & Test up'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Move Explore & Test up');

    await user.hover(screen.getByLabelText('Rename Explore & Test'));
    const renameTooltip = await screen.findByRole('tooltip');
    expect(renameTooltip).toHaveTextContent('Rename Explore & Test');
    expect(renameTooltip).not.toHaveTextContent('Rename Explore &amp; Test');

    await user.hover(screen.getByLabelText('Hide Explore & Test'));
    const hideTooltip = await screen.findByRole('tooltip');
    expect(hideTooltip).toHaveTextContent('Hide Explore & Test');
    expect(hideTooltip).not.toHaveTextContent('Hide Explore &amp; Test');
  });

  it('shows a Show tooltip and disables move controls at the boundary when hidden and clamped', async () => {
    const { user } = renderItemText({
      itemName: 'Explore & Test',
      editMode: true,
      isCustomizable: true,
      isHidden: true,
      canMoveUp: false,
      canMoveDown: false,
    });

    await user.hover(screen.getByLabelText('Show Explore & Test'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Show Explore & Test');
    expect(screen.getByLabelText('Move Explore & Test up')).toBeDisabled();
    expect(screen.getByLabelText('Move Explore & Test down')).toBeDisabled();
  });

  it('calls onToggleHidden, onMoveUp, onMoveDown and onRename', async () => {
    const onToggleHidden = jest.fn();
    const onMoveUp = jest.fn();
    const onMoveDown = jest.fn();
    const { user } = renderItemText({
      itemName: 'Explore',
      editMode: true,
      isCustomizable: true,
      canMoveUp: true,
      canMoveDown: true,
      onToggleHidden,
      onMoveUp,
      onMoveDown,
    });

    await user.click(screen.getByLabelText('Hide Explore'));
    expect(onToggleHidden).toHaveBeenCalledTimes(1);

    await user.click(screen.getByLabelText('Move Explore up'));
    expect(onMoveUp).toHaveBeenCalledTimes(1);

    await user.click(screen.getByLabelText('Move Explore down'));
    expect(onMoveDown).toHaveBeenCalledTimes(1);
  });

  it('calls onRename with the prompt result', async () => {
    const onRename = jest.fn();
    jest.spyOn(window, 'prompt').mockReturnValue('New name');
    const { user } = renderItemText({
      itemName: 'Explore',
      editMode: true,
      isCustomizable: true,
      onRename,
    });

    await user.click(screen.getByLabelText('Rename Explore'));
    expect(onRename).toHaveBeenCalledWith('New name');

    jest.restoreAllMocks();
  });

  it('does not call onRename when the prompt is dismissed', async () => {
    const onRename = jest.fn();
    jest.spyOn(window, 'prompt').mockReturnValue(null);
    const { user } = renderItemText({
      itemName: 'Explore',
      editMode: true,
      isCustomizable: true,
      onRename,
    });

    await user.click(screen.getByLabelText('Rename Explore'));
    expect(onRename).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });
});
