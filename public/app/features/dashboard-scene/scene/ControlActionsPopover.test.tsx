import { fireEvent, render, screen } from 'test/test-utils';

import { CustomVariable, SceneFlexLayout, SceneVariableSet } from '@grafana/scenes';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import { ControlActionsPopover, ControlEditActions } from './ControlActionsPopover';
import { DashboardAnnotationsDataLayer } from './DashboardAnnotationsDataLayer';

jest.mock('app/core/app_events', () => ({
  appEvents: {
    subscribe: jest.fn(),
    publish: jest.fn(),
  },
}));
const mockPublishAppEvent = jest.mocked(appEvents.publish);

describe('<ControlActionsPopover />', () => {
  describe('when isEditable is false', () => {
    test('renders children and does not show floating content on hover', () => {
      render(
        <ControlActionsPopover isEditable={false} content={<span>popover-actions</span>}>
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
        <ControlActionsPopover isEditable={true} content={<span>popover-actions</span>}>
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

function buildVariable() {
  const variable = new CustomVariable({ name: 'testVar' });
  new SceneVariableSet({ variables: [variable] }); // just to set variable.parent
  return variable;
}
function buildDataLayer() {
  return new DashboardAnnotationsDataLayer({
    name: 'Test annotation',
    query: {
      name: 'Test annotation',
      enable: false,
      iconColor: '',
    },
  });
}
function buildLink() {
  return { name: 'Test link', type: 'link' };
}

describe('<ControlEditActions />', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders edit and delete controls with accessible names', () => {
    const onClickEdit = jest.fn();
    const onClickDelete = jest.fn();

    render(<ControlEditActions element={buildVariable()} onClickEdit={onClickEdit} onClickDelete={onClickDelete} />);

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  describe('when the user clicks on the edit action', () => {
    test('calls onClickEdit and the event does not bubble to ancestors', () => {
      const onClickEdit = jest.fn();
      const onClickDelete = jest.fn();
      const onAncestorPointerDown = jest.fn();

      render(
        <div onPointerDown={onAncestorPointerDown}>
          <ControlEditActions element={buildVariable()} onClickEdit={onClickEdit} onClickDelete={onClickDelete} />
        </div>
      );

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Edit' }));

      expect(onClickEdit).toHaveBeenCalledTimes(1);
      expect(onClickDelete).not.toHaveBeenCalled();
      expect(onAncestorPointerDown).not.toHaveBeenCalled();
    });
  });

  describe('when the user clicks on the delete action', () => {
    const variable = buildVariable();
    const dataLayer = buildDataLayer();
    const link = buildLink();

    describe.each([
      ['variable', variable, variable.state.name],
      ['annotation query', dataLayer, dataLayer.state.name],
      ['link', link, link.name],
      ['unknown type', new SceneFlexLayout({ children: [] }), ''],
    ])('%s deletion', (type, element, name) => {
      test('publishes a ShowConfirmModalEvent and the click event does not bubble to ancestors', () => {
        const onClickEdit = jest.fn();
        const onClickDelete = jest.fn();
        const onAncestorPointerDown = jest.fn();

        render(
          <div onPointerDown={onAncestorPointerDown}>
            <ControlEditActions element={element} onClickEdit={onClickEdit} onClickDelete={onClickDelete} />
          </div>
        );

        fireEvent.pointerDown(screen.getByRole('button', { name: 'Delete' }));

        expect(mockPublishAppEvent).toHaveBeenCalledTimes(1);

        const [arg] = mockPublishAppEvent.mock.calls[0];
        expect(arg).toBeInstanceOf(ShowConfirmModalEvent);
        expect(arg).toEqual(
          expect.objectContaining({
            payload: {
              title: `Delete ${type}`,
              text: expect.stringContaining(`Are you sure you want to delete: ${name}?`),
              yesText: `Delete ${type}`,
              onConfirm: onClickDelete,
            },
          })
        );

        expect(onAncestorPointerDown).not.toHaveBeenCalled();
      });
    });
  });
});
