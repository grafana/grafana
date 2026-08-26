import { fireEvent, render, screen } from 'test/test-utils';

import { ConstantVariable, CustomVariable, QueryVariable, type SceneVariable } from '@grafana/scenes';
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

  describe('when the variable is a ConstantVariable', () => {
    test('renders Settings, Duplicate, and Delete controls', () => {
      renderVariableEditActions(new ConstantVariable({ name: 'constVar', value: '42' }));

      expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();

      expect(screen.queryByRole('button', { name: 'Edit values' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit query' })).not.toBeInTheDocument();
    });
  });

  describe('when the variable is a CustomVariable', () => {
    test('renders Settings, Edit values, Duplicate, and Delete controls', () => {
      renderVariableEditActions(new CustomVariable({ name: 'testVar' }));

      expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Edit values' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();

      expect(screen.queryByRole('button', { name: 'Edit query' })).not.toBeInTheDocument();
    });

    test('calls onClickEditQuery when the user clicks on Edit values', () => {
      const { onClickEditQuery } = renderVariableEditActions(new CustomVariable({ name: 'testVar' }));

      fireEvent.click(screen.getByRole('button', { name: 'Edit values' }));

      expect(onClickEditQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the variable is a QueryVariable', () => {
    test('renders Settings, Edit query, Duplicate, and Delete controls', () => {
      renderVariableEditActions(new QueryVariable({ name: 'queryVar', query: 'label_values(job)' }));

      expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Edit query' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();

      expect(screen.queryByRole('button', { name: 'Edit values' })).not.toBeInTheDocument();
    });

    test('calls onClickEditQuery when the user clicks Edit query', () => {
      const { onClickEditQuery } = renderVariableEditActions(
        new QueryVariable({ name: 'queryVar', query: 'label_values(job)' })
      );

      fireEvent.click(screen.getByRole('button', { name: 'Edit query' }));

      expect(onClickEditQuery).toHaveBeenCalledTimes(1);
    });
  });

  test('calls onClickEdit when the user clicks on Settings', () => {
    const { onClickEdit } = renderVariableEditActions(new CustomVariable({ name: 'testVar' }));

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(onClickEdit).toHaveBeenCalledTimes(1);
  });

  test('calls onClickDuplicate when the user clicks on Duplicate', () => {
    const { onClickDuplicate } = renderVariableEditActions(new CustomVariable({ name: 'testVar' }));

    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

    expect(onClickDuplicate).toHaveBeenCalledTimes(1);
  });

  test('publishes a ShowConfirmModalEvent when the user clicks Delete', () => {
    const variable = new CustomVariable({ name: 'testVar' });
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
