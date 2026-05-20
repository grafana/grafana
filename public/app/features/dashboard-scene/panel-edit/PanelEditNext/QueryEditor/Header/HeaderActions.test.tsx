import { screen } from '@testing-library/react';

import { type ActionItem } from '../../Actions';
import { QueryEditorType } from '../../constants';
import { renderWithQueryEditorProvider } from '../testUtils';
import { type Transformation } from '../types';

import { HeaderActions } from './HeaderActions';

interface MockActionsProps {
  item: ActionItem;
  onDelete?: () => void;
  onToggleHide?: () => void;
}

jest.mock('../../Actions', () => ({
  Actions: ({ item, onDelete, onToggleHide }: MockActionsProps) => (
    <div
      data-testid="actions"
      data-item-type={item.type}
      data-item-name={item.name}
      data-item-hidden={String(item.isHidden)}
    >
      {onToggleHide && <button onClick={onToggleHide}>Toggle hide action</button>}
      {onDelete && <button onClick={onDelete}>Delete action</button>}
    </div>
  ),
}));

jest.mock('./WarningBadges', () => ({
  WarningBadges: () => <div data-testid="warning-badges" />,
}));

jest.mock('./SaveButton', () => ({
  SaveButton: () => <div data-testid="save-button" />,
}));

jest.mock('./PluginActions', () => ({
  PluginActions: () => <div data-testid="plugin-actions" />,
}));

jest.mock('./ExperimentalFeedbackButton', () => ({
  ExperimentalFeedbackButton: () => <div data-testid="experimental-feedback-button" />,
}));

jest.mock('./QueryActionsMenu', () => ({
  QueryActionsMenu: () => <div data-testid="query-actions-menu" />,
}));

jest.mock('./TransformationActionButtons', () => ({
  TransformationActionButtons: () => <div data-testid="transformation-action-buttons" />,
}));

const makeTransformation = (overrides: Partial<Transformation> = {}): Transformation => ({
  transformId: 'transform-1',
  transformConfig: { id: 'test-transform', options: {} },
  registryItem: { name: 'Test transformation' } as Transformation['registryItem'],
  ...overrides,
});

describe('HeaderActions', () => {
  it('renders query actions and routes hide/delete to selected query handlers', async () => {
    const toggleQueryHide = jest.fn();
    const deleteQuery = jest.fn();

    const { user } = renderWithQueryEditorProvider(<HeaderActions />, {
      selectedQuery: { refId: 'A', hide: false },
      uiStateOverrides: { cardType: QueryEditorType.Query },
      actionsOverrides: { toggleQueryHide, deleteQuery },
    });

    expect(screen.getByTestId('query-actions-menu')).toBeInTheDocument();
    expect(screen.queryByTestId('transformation-action-buttons')).not.toBeInTheDocument();
    expect(screen.getByTestId('actions')).toHaveAttribute('data-item-type', QueryEditorType.Query);
    expect(screen.getByTestId('actions')).toHaveAttribute('data-item-name', 'A');
    expect(screen.getByTestId('actions')).toHaveAttribute('data-item-hidden', 'false');

    await user.click(screen.getByRole('button', { name: 'Toggle hide action' }));
    await user.click(screen.getByRole('button', { name: 'Delete action' }));

    expect(toggleQueryHide).toHaveBeenCalledWith('A');
    expect(deleteQuery).toHaveBeenCalledWith('A');
  });

  it('routes expression hide/delete callbacks through selected query refId', async () => {
    const toggleQueryHide = jest.fn();
    const deleteQuery = jest.fn();

    const { user } = renderWithQueryEditorProvider(<HeaderActions />, {
      selectedQuery: { refId: 'B', hide: true },
      uiStateOverrides: { cardType: QueryEditorType.Expression },
      actionsOverrides: { toggleQueryHide, deleteQuery },
    });

    expect(screen.getByTestId('query-actions-menu')).toBeInTheDocument();
    expect(screen.getByTestId('actions')).toHaveAttribute('data-item-type', QueryEditorType.Expression);
    expect(screen.getByTestId('actions')).toHaveAttribute('data-item-hidden', 'true');

    await user.click(screen.getByRole('button', { name: 'Toggle hide action' }));
    await user.click(screen.getByRole('button', { name: 'Delete action' }));

    expect(toggleQueryHide).toHaveBeenCalledWith('B');
    expect(deleteQuery).toHaveBeenCalledWith('B');
  });

  it('renders transformation buttons and routes hide/delete to selected transformation handlers', async () => {
    const toggleTransformationDisabled = jest.fn();
    const deleteTransformation = jest.fn();
    const selectedTransformation = makeTransformation({
      transformId: 'transform-42',
      transformConfig: { id: 'test-transform', options: {}, disabled: true },
      registryItem: { name: 'Reduce' } as Transformation['registryItem'],
    });

    const { user } = renderWithQueryEditorProvider(<HeaderActions />, {
      selectedTransformation,
      uiStateOverrides: { cardType: QueryEditorType.Transformation },
      actionsOverrides: { toggleTransformationDisabled, deleteTransformation },
    });

    expect(screen.getByTestId('transformation-action-buttons')).toBeInTheDocument();
    expect(screen.queryByTestId('query-actions-menu')).not.toBeInTheDocument();
    expect(screen.getByTestId('actions')).toHaveAttribute('data-item-type', QueryEditorType.Transformation);
    expect(screen.getByTestId('actions')).toHaveAttribute('data-item-name', 'Reduce');
    expect(screen.getByTestId('actions')).toHaveAttribute('data-item-hidden', 'true');

    await user.click(screen.getByRole('button', { name: 'Toggle hide action' }));
    await user.click(screen.getByRole('button', { name: 'Delete action' }));

    expect(toggleTransformationDisabled).toHaveBeenCalledWith('transform-42');
    expect(deleteTransformation).toHaveBeenCalledWith('transform-42');
  });
});
