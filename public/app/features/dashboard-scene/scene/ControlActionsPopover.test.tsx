import { fireEvent, render, screen } from 'test/test-utils';

import { CustomVariable, QueryVariable, SceneVariableSet } from '@grafana/scenes';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import {
  AnnotationEditActions,
  ControlActionsPopover,
  LinkEditActions,
  VariableEditActions,
} from './ControlActionsPopover';
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

  describe('when a popover action opens a modal', () => {
    async function renderAndOpenPopover(content: React.ReactNode) {
      const { user } = render(
        <ControlActionsPopover isEditable={true} content={content}>
          <div data-testid="reference-child">control</div>
        </ControlActionsPopover>
      );

      await user.hover(screen.getByTestId('reference-child'));
      return { user };
    }

    test('clicking Edit query closes the popover', async () => {
      await renderAndOpenPopover(
        <VariableEditActions
          variable={buildQueryVariable()}
          onClickEdit={jest.fn()}
          onClickEditQuery={jest.fn()}
          onClickDuplicate={jest.fn()}
          onClickDelete={jest.fn()}
        />
      );

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Edit query' }));

      expect(screen.queryByRole('button', { name: 'Edit query' })).not.toBeInTheDocument();
    });

    test('clicking the delete action closes the popover', async () => {
      await renderAndOpenPopover(
        <LinkEditActions
          name="Test link"
          onClickEdit={jest.fn()}
          onClickDuplicate={jest.fn()}
          onClickDelete={jest.fn()}
        />
      );

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Delete' }));

      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });

    test('clicking the annotation Edit query action closes the popover', async () => {
      await renderAndOpenPopover(
        <AnnotationEditActions
          layer={buildDataLayer()}
          onClickEdit={jest.fn()}
          onClickEditQuery={jest.fn()}
          onClickDuplicate={jest.fn()}
          onClickDelete={jest.fn()}
        />
      );

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Edit query' }));

      expect(screen.queryByRole('button', { name: 'Edit query' })).not.toBeInTheDocument();
    });

    test('clicking Variable settings keeps the popover open', async () => {
      await renderAndOpenPopover(
        <VariableEditActions
          variable={buildQueryVariable()}
          onClickEdit={jest.fn()}
          onClickEditQuery={jest.fn()}
          onClickDuplicate={jest.fn()}
          onClickDelete={jest.fn()}
        />
      );

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Variable settings' }));

      expect(screen.getByRole('button', { name: 'Variable settings' })).toBeInTheDocument();
    });

    test('clicking Duplicate keeps the popover open', async () => {
      await renderAndOpenPopover(
        <VariableEditActions
          variable={buildQueryVariable()}
          onClickEdit={jest.fn()}
          onClickEditQuery={jest.fn()}
          onClickDuplicate={jest.fn()}
          onClickDelete={jest.fn()}
        />
      );

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Duplicate' }));

      expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
    });
  });
});

function buildVariable() {
  const variable = new CustomVariable({ name: 'testVar' });
  new SceneVariableSet({ variables: [variable] }); // just to set variable.parent
  return variable;
}
function buildQueryVariable() {
  const variable = new QueryVariable({ name: 'queryVar', query: 'label_values(job)' });
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

describe('<VariableEditActions />', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  function renderVariableEditActions(variable: CustomVariable | QueryVariable) {
    const onClickEdit = jest.fn();
    const onClickEditQuery = jest.fn();
    const onClickDuplicate = jest.fn();
    const onClickDelete = jest.fn();
    const onAncestorPointerDown = jest.fn();

    const renderResult = render(
      <div onPointerDown={onAncestorPointerDown}>
        <VariableEditActions
          variable={variable}
          onClickEdit={onClickEdit}
          onClickEditQuery={onClickEditQuery}
          onClickDuplicate={onClickDuplicate}
          onClickDelete={onClickDelete}
        />
      </div>
    );

    return { ...renderResult, onClickEdit, onClickEditQuery, onClickDuplicate, onClickDelete, onAncestorPointerDown };
  }

  test('renders variable settings, edit options, duplicate, and delete controls for a custom variable', () => {
    renderVariableEditActions(buildVariable());

    expect(screen.getByRole('button', { name: 'Variable settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit options' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit query' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  describe('when the variable is a QueryVariable', () => {
    test('renders the Edit query action', () => {
      renderVariableEditActions(buildQueryVariable());

      expect(screen.getByRole('button', { name: 'Edit query' })).toBeInTheDocument();
    });
  });

  describe('when the user clicks on Variable settings', () => {
    test('calls onClickEdit and the event does not bubble to ancestors', () => {
      const { onClickEdit, onClickDelete, onAncestorPointerDown } = renderVariableEditActions(buildVariable());

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Variable settings' }));

      expect(onClickEdit).toHaveBeenCalledTimes(1);
      expect(onClickDelete).not.toHaveBeenCalled();
      expect(onAncestorPointerDown).not.toHaveBeenCalled();
    });
  });

  describe('when the user clicks on Edit query', () => {
    test('calls onClickEditQuery and the event does not bubble to ancestors', () => {
      const { onClickEdit, onClickEditQuery, onAncestorPointerDown } = renderVariableEditActions(buildQueryVariable());

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Edit query' }));

      expect(onClickEditQuery).toHaveBeenCalledTimes(1);
      expect(onClickEdit).not.toHaveBeenCalled();
      expect(onAncestorPointerDown).not.toHaveBeenCalled();
    });
  });

  describe('when the user clicks on Edit options', () => {
    test('calls onClickEditQuery and the event does not bubble to ancestors', () => {
      const { onClickEdit, onClickEditQuery, onAncestorPointerDown } = renderVariableEditActions(buildVariable());

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Edit options' }));

      expect(onClickEditQuery).toHaveBeenCalledTimes(1);
      expect(onClickEdit).not.toHaveBeenCalled();
      expect(onAncestorPointerDown).not.toHaveBeenCalled();
    });
  });

  describe('when the user clicks on Duplicate', () => {
    test('calls onClickDuplicate and the event does not bubble to ancestors', () => {
      const { onClickEdit, onClickDuplicate, onClickDelete, onAncestorPointerDown } =
        renderVariableEditActions(buildVariable());

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Duplicate' }));

      expect(onClickDuplicate).toHaveBeenCalledTimes(1);
      expect(onClickEdit).not.toHaveBeenCalled();
      expect(onClickDelete).not.toHaveBeenCalled();
      expect(onAncestorPointerDown).not.toHaveBeenCalled();
    });
  });

  describe('when the user clicks on the delete action', () => {
    test('publishes a ShowConfirmModalEvent and the click event does not bubble to ancestors', () => {
      const variable = buildVariable();
      const { onClickDelete, onAncestorPointerDown } = renderVariableEditActions(variable);

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Delete' }));

      expect(mockPublishAppEvent).toHaveBeenCalledTimes(1);

      const [arg] = mockPublishAppEvent.mock.calls[0];
      expect(arg).toBeInstanceOf(ShowConfirmModalEvent);
      expect(arg).toEqual(
        expect.objectContaining({
          payload: {
            title: 'Delete variable',
            text: expect.stringContaining(`Are you sure you want to delete: ${variable.state.name}?`),
            yesText: 'Delete variable',
            onConfirm: onClickDelete,
          },
        })
      );

      expect(onAncestorPointerDown).not.toHaveBeenCalled();
    });
  });
});

describe('<LinkEditActions />', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  function renderLinkEditActions() {
    const onClickEdit = jest.fn();
    const onClickDuplicate = jest.fn();
    const onClickDelete = jest.fn();
    const onAncestorPointerDown = jest.fn();

    const renderResult = render(
      <div onPointerDown={onAncestorPointerDown}>
        <LinkEditActions
          name="Test link"
          onClickEdit={onClickEdit}
          onClickDuplicate={onClickDuplicate}
          onClickDelete={onClickDelete}
        />
      </div>
    );

    return { ...renderResult, onClickEdit, onClickDuplicate, onClickDelete, onAncestorPointerDown };
  }

  test('renders link settings, duplicate, and delete controls', () => {
    renderLinkEditActions();

    expect(screen.getByRole('button', { name: 'Link settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  describe('when the user clicks on Link settings', () => {
    test('calls onClickEdit and the event does not bubble to ancestors', () => {
      const { onClickEdit, onClickDelete, onAncestorPointerDown } = renderLinkEditActions();

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Link settings' }));

      expect(onClickEdit).toHaveBeenCalledTimes(1);
      expect(onClickDelete).not.toHaveBeenCalled();
      expect(onAncestorPointerDown).not.toHaveBeenCalled();
    });
  });

  describe('when the user clicks on Duplicate', () => {
    test('calls onClickDuplicate and the event does not bubble to ancestors', () => {
      const { onClickEdit, onClickDuplicate, onClickDelete, onAncestorPointerDown } = renderLinkEditActions();

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Duplicate' }));

      expect(onClickDuplicate).toHaveBeenCalledTimes(1);
      expect(onClickEdit).not.toHaveBeenCalled();
      expect(onClickDelete).not.toHaveBeenCalled();
      expect(onAncestorPointerDown).not.toHaveBeenCalled();
    });
  });

  describe('when the user clicks on the delete action', () => {
    test('publishes a ShowConfirmModalEvent and the click event does not bubble to ancestors', () => {
      const { onClickDelete, onAncestorPointerDown } = renderLinkEditActions();

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Delete' }));

      expect(mockPublishAppEvent).toHaveBeenCalledTimes(1);

      const [arg] = mockPublishAppEvent.mock.calls[0];
      expect(arg).toBeInstanceOf(ShowConfirmModalEvent);
      expect(arg).toEqual(
        expect.objectContaining({
          payload: {
            title: 'Delete link',
            text: expect.stringContaining('Are you sure you want to delete: Test link?'),
            yesText: 'Delete link',
            onConfirm: onClickDelete,
          },
        })
      );

      expect(onAncestorPointerDown).not.toHaveBeenCalled();
    });
  });
});

describe('<AnnotationEditActions />', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  function renderAnnotationEditActions(dataLayer = buildDataLayer()) {
    const onClickEdit = jest.fn();
    const onClickEditQuery = jest.fn();
    const onClickDuplicate = jest.fn();
    const onClickDelete = jest.fn();
    const onAncestorPointerDown = jest.fn();

    const renderResult = render(
      <div onPointerDown={onAncestorPointerDown}>
        <AnnotationEditActions
          layer={dataLayer}
          onClickEdit={onClickEdit}
          onClickEditQuery={onClickEditQuery}
          onClickDuplicate={onClickDuplicate}
          onClickDelete={onClickDelete}
        />
      </div>
    );

    return { ...renderResult, onClickEdit, onClickEditQuery, onClickDuplicate, onClickDelete, onAncestorPointerDown };
  }

  test('renders annotation settings, edit query, duplicate, and delete controls', () => {
    renderAnnotationEditActions();

    expect(screen.getByRole('button', { name: 'Annotation settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit query' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  describe('when the user clicks on Annotation settings', () => {
    test('calls onClickEdit and the event does not bubble to ancestors', () => {
      const { onClickEdit, onClickDelete, onAncestorPointerDown } = renderAnnotationEditActions();

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Annotation settings' }));

      expect(onClickEdit).toHaveBeenCalledTimes(1);
      expect(onClickDelete).not.toHaveBeenCalled();
      expect(onAncestorPointerDown).not.toHaveBeenCalled();
    });
  });

  describe('when the user clicks on Edit query', () => {
    test('calls onClickEditQuery and the event does not bubble to ancestors', () => {
      const { onClickEdit, onClickEditQuery, onAncestorPointerDown } = renderAnnotationEditActions();

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Edit query' }));

      expect(onClickEditQuery).toHaveBeenCalledTimes(1);
      expect(onClickEdit).not.toHaveBeenCalled();
      expect(onAncestorPointerDown).not.toHaveBeenCalled();
    });
  });

  describe('when the user clicks on Duplicate', () => {
    test('calls onClickDuplicate and the event does not bubble to ancestors', () => {
      const { onClickEdit, onClickDuplicate, onClickDelete, onAncestorPointerDown } = renderAnnotationEditActions();

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Duplicate' }));

      expect(onClickDuplicate).toHaveBeenCalledTimes(1);
      expect(onClickEdit).not.toHaveBeenCalled();
      expect(onClickDelete).not.toHaveBeenCalled();
      expect(onAncestorPointerDown).not.toHaveBeenCalled();
    });
  });

  describe('when the user clicks on the delete action', () => {
    test('publishes a ShowConfirmModalEvent and the click event does not bubble to ancestors', () => {
      const dataLayer = buildDataLayer();
      const { onClickDelete, onAncestorPointerDown } = renderAnnotationEditActions(dataLayer);

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Delete' }));

      expect(mockPublishAppEvent).toHaveBeenCalledTimes(1);

      const [arg] = mockPublishAppEvent.mock.calls[0];
      expect(arg).toBeInstanceOf(ShowConfirmModalEvent);
      expect(arg).toEqual(
        expect.objectContaining({
          payload: {
            title: 'Delete annotation query',
            text: expect.stringContaining(`Are you sure you want to delete: ${dataLayer.state.name}?`),
            yesText: 'Delete annotation query',
            onConfirm: onClickDelete,
          },
        })
      );

      expect(onAncestorPointerDown).not.toHaveBeenCalled();
    });
  });
});
