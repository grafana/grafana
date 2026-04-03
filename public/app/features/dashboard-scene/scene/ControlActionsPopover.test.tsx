import { fireEvent, render, screen } from 'test/test-utils';

import { ControlActionsPopover, ControlEditActions } from './ControlActionsPopover';

function buildPopoverContent(label: string) {
  return <span>{label}</span>;
}

describe('<ControlActionsPopover />', () => {
  describe('when isEditable is false', () => {
    test('renders children and does not show floating content on hover', () => {
      render(
        <ControlActionsPopover isEditable={false} content={buildPopoverContent('popover-actions')}>
          <div data-testid="reference-child">variable control</div>
        </ControlActionsPopover>
      );

      expect(screen.getByTestId('reference-child')).toHaveTextContent('variable control');
      expect(screen.queryByText('popover-actions')).not.toBeInTheDocument();
    });
  });

  describe('when isEditable is true', () => {
    test('if the user hovers the reference, then floating content is shown in the document', async () => {
      const { user } = render(
        <ControlActionsPopover isEditable={true} content={buildPopoverContent('popover-actions')}>
          <div data-testid="reference-child">variable control</div>
        </ControlActionsPopover>
      );

      expect(screen.queryByText('popover-actions')).not.toBeInTheDocument();

      const referenceChild = screen.getByTestId('reference-child');
      await user.hover(referenceChild);

      expect(screen.getByText('popover-actions')).toBeInTheDocument();
    });

    test('if content is null, then no floating panel is mounted when open', async () => {
      const { user } = render(
        <ControlActionsPopover isEditable={true} content={null}>
          <div data-testid="reference-child">variable control</div>
        </ControlActionsPopover>
      );

      expect(screen.queryByText('popover-actions')).not.toBeInTheDocument();

      const referenceChild = screen.getByTestId('reference-child');
      await user.hover(referenceChild);

      expect(screen.queryByText('popover-actions')).not.toBeInTheDocument();
    });
  });
});

describe('<ControlEditActions />', () => {
  test('renders edit and delete controls with accessible names', () => {
    const onClickEdit = jest.fn();
    const onClickDelete = jest.fn();

    render(<ControlEditActions onClickEdit={onClickEdit} onClickDelete={onClickDelete} />);

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  describe('when the user activates the edit action', () => {
    test('then onClickEdit runs and the event does not bubble to ancestors', () => {
      const onClickEdit = jest.fn();
      const onClickDelete = jest.fn();
      const onAncestorPointerDown = jest.fn();

      render(
        <div onPointerDown={onAncestorPointerDown}>
          <ControlEditActions onClickEdit={onClickEdit} onClickDelete={onClickDelete} />
        </div>
      );

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Edit' }));

      expect(onClickEdit).toHaveBeenCalledTimes(1);
      expect(onClickDelete).not.toHaveBeenCalled();
      expect(onAncestorPointerDown).not.toHaveBeenCalled();
    });
  });

  describe('when the user activates the delete action', () => {
    test('then onClickDelete runs and the event does not bubble to ancestors', () => {
      const onClickEdit = jest.fn();
      const onClickDelete = jest.fn();
      const onAncestorPointerDown = jest.fn();

      render(
        <div onPointerDown={onAncestorPointerDown}>
          <ControlEditActions onClickEdit={onClickEdit} onClickDelete={onClickDelete} />
        </div>
      );

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Delete' }));

      expect(onClickDelete).toHaveBeenCalledTimes(1);
      expect(onClickEdit).not.toHaveBeenCalled();
      expect(onAncestorPointerDown).not.toHaveBeenCalled();
    });
  });
});
