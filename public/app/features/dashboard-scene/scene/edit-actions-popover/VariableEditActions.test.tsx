import { fireEvent, render, screen } from 'test/test-utils';

import { ConstantVariable, CustomVariable, QueryVariable, type SceneVariable, SceneVariableSet } from '@grafana/scenes';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import { VariableEditActions } from './VariableEditActions';

jest.mock('app/core/app_events', () => ({
  appEvents: {
    subscribe: jest.fn(),
    publish: jest.fn(),
  },
}));
const mockPublishAppEvent = jest.mocked(appEvents.publish);

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

describe('<VariableEditActions />', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

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
