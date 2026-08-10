import { createEvent, fireEvent, render, screen } from 'test/test-utils';

import { ConstantVariable, CustomVariable, QueryVariable, type SceneVariable, SceneVariableSet } from '@grafana/scenes';
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

    test('pointerdown stops event propagation', async () => {
      const { user } = render(
        <ControlActionsPopover isEditable={true} content={<button>action</button>}>
          <div data-testid="reference-child">control</div>
        </ControlActionsPopover>
      );

      await user.hover(screen.getByTestId('reference-child'));

      const actionButton = screen.getByRole('button', { name: 'action' });
      const pointerDownEvent = createEvent.pointerDown(actionButton);
      const stopPropagation = jest.spyOn(pointerDownEvent, 'stopPropagation');

      fireEvent(actionButton, pointerDownEvent);

      expect(stopPropagation).toHaveBeenCalled();
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

      fireEvent.click(screen.getByRole('button', { name: 'Edit query' }));

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

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

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

      fireEvent.click(screen.getByRole('button', { name: 'Edit query' }));

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

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

      expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
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

      fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

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
function buildConstantVariable() {
  const variable = new ConstantVariable({ name: 'constVar', value: '42' });
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

  function renderVariableEditActions(variable: SceneVariable) {
    const onClickEdit = jest.fn();
    const onClickEditQuery = jest.fn();
    const onClickDuplicate = jest.fn();
    const onClickDelete = jest.fn();

    const renderResult = render(
      <VariableEditActions
        variable={variable}
        onClickEdit={onClickEdit}
        onClickEditQuery={onClickEditQuery}
        onClickDuplicate={onClickDuplicate}
        onClickDelete={onClickDelete}
      />
    );

    return { ...renderResult, onClickEdit, onClickEditQuery, onClickDuplicate, onClickDelete };
  }

  test('renders variable settings, edit values, duplicate, and delete controls for a custom variable', () => {
    renderVariableEditActions(buildVariable());

    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit values' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit query' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  test('renders settings, duplicate, and delete controls for a constant variable without edit query or edit values', () => {
    renderVariableEditActions(buildConstantVariable());

    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit values' })).not.toBeInTheDocument();
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
    test('calls onClickEdit', () => {
      const { onClickEdit, onClickDelete } = renderVariableEditActions(buildVariable());

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

      expect(onClickEdit).toHaveBeenCalledTimes(1);
      expect(onClickDelete).not.toHaveBeenCalled();
    });
  });

  describe('when the user clicks on Edit query', () => {
    test('calls onClickEditQuery', () => {
      const { onClickEdit, onClickEditQuery } = renderVariableEditActions(buildQueryVariable());

      fireEvent.click(screen.getByRole('button', { name: 'Edit query' }));

      expect(onClickEditQuery).toHaveBeenCalledTimes(1);
      expect(onClickEdit).not.toHaveBeenCalled();
    });
  });

  describe('when the user clicks on Edit values', () => {
    test('calls onClickEditQuery', () => {
      const { onClickEdit, onClickEditQuery } = renderVariableEditActions(buildVariable());

      fireEvent.click(screen.getByRole('button', { name: 'Edit values' }));

      expect(onClickEditQuery).toHaveBeenCalledTimes(1);
      expect(onClickEdit).not.toHaveBeenCalled();
    });
  });

  describe('when the user clicks on Duplicate', () => {
    test('calls onClickDuplicate', () => {
      const { onClickEdit, onClickDuplicate, onClickDelete } = renderVariableEditActions(buildVariable());

      fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

      expect(onClickDuplicate).toHaveBeenCalledTimes(1);
      expect(onClickEdit).not.toHaveBeenCalled();
      expect(onClickDelete).not.toHaveBeenCalled();
    });
  });

  describe('when the user clicks on the delete action', () => {
    test('publishes a ShowConfirmModalEvent', () => {
      const variable = buildVariable();
      const { onClickDelete } = renderVariableEditActions(variable);

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

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

    const renderResult = render(
      <LinkEditActions
        name="Test link"
        onClickEdit={onClickEdit}
        onClickDuplicate={onClickDuplicate}
        onClickDelete={onClickDelete}
      />
    );

    return { ...renderResult, onClickEdit, onClickDuplicate, onClickDelete };
  }

  test('renders link settings, duplicate, and delete controls', () => {
    renderLinkEditActions();

    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  describe('when the user clicks on Link settings', () => {
    test('calls onClickEdit', () => {
      const { onClickEdit, onClickDelete } = renderLinkEditActions();

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

      expect(onClickEdit).toHaveBeenCalledTimes(1);
      expect(onClickDelete).not.toHaveBeenCalled();
    });
  });

  describe('when the user clicks on Duplicate', () => {
    test('calls onClickDuplicate', () => {
      const { onClickEdit, onClickDuplicate, onClickDelete } = renderLinkEditActions();

      fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

      expect(onClickDuplicate).toHaveBeenCalledTimes(1);
      expect(onClickEdit).not.toHaveBeenCalled();
      expect(onClickDelete).not.toHaveBeenCalled();
    });
  });

  describe('when the user clicks on the delete action', () => {
    test('publishes a ShowConfirmModalEvent', () => {
      const { onClickDelete } = renderLinkEditActions();

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

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

    const renderResult = render(
      <AnnotationEditActions
        layer={dataLayer}
        onClickEdit={onClickEdit}
        onClickEditQuery={onClickEditQuery}
        onClickDuplicate={onClickDuplicate}
        onClickDelete={onClickDelete}
      />
    );

    return { ...renderResult, onClickEdit, onClickEditQuery, onClickDuplicate, onClickDelete };
  }

  test('renders annotation settings, edit query, duplicate, and delete controls', () => {
    renderAnnotationEditActions();

    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit query' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  describe('when the user clicks on Annotation settings', () => {
    test('calls onClickEdit', () => {
      const { onClickEdit, onClickDelete } = renderAnnotationEditActions();

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

      expect(onClickEdit).toHaveBeenCalledTimes(1);
      expect(onClickDelete).not.toHaveBeenCalled();
    });
  });

  describe('when the user clicks on Edit query', () => {
    test('calls onClickEditQuery', () => {
      const { onClickEdit, onClickEditQuery } = renderAnnotationEditActions();

      fireEvent.click(screen.getByRole('button', { name: 'Edit query' }));

      expect(onClickEditQuery).toHaveBeenCalledTimes(1);
      expect(onClickEdit).not.toHaveBeenCalled();
    });
  });

  describe('when the user clicks on Duplicate', () => {
    test('calls onClickDuplicate', () => {
      const { onClickEdit, onClickDuplicate, onClickDelete } = renderAnnotationEditActions();

      fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

      expect(onClickDuplicate).toHaveBeenCalledTimes(1);
      expect(onClickEdit).not.toHaveBeenCalled();
      expect(onClickDelete).not.toHaveBeenCalled();
    });
  });

  describe('when the user clicks on the delete action', () => {
    test('publishes a ShowConfirmModalEvent', () => {
      const dataLayer = buildDataLayer();
      const { onClickDelete } = renderAnnotationEditActions(dataLayer);

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

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
    });
  });
});
