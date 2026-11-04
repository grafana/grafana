import { screen } from '@testing-library/react';

import { trackAddTransformationInitiated } from '../../tracking';
import { renderWithQueryEditorProvider } from '../testUtils';

import { StackedAddBar } from './StackedAddBar';

jest.mock('app/features/explore/QueryLibrary/QueryLibraryContext', () => ({
  useQueryLibraryContext: () => ({ openDrawer: jest.fn(), queryLibraryEnabled: false }),
}));

jest.mock('../../tracking', () => ({
  ...jest.requireActual('../../tracking'),
  trackAddTransformationInitiated: jest.fn(),
}));

describe('StackedAddBar', () => {
  it('query bar opens the add menu below the box', async () => {
    const { user } = renderWithQueryEditorProvider(<StackedAddBar variant="query" afterId="A" />);

    const button = screen.getByRole('button', { name: 'Add below A' });
    expect(button).toHaveTextContent('Add');

    await user.click(button);

    expect(screen.getByRole('menuitem', { name: 'Add query' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add transformation' })).toBeInTheDocument();
  });

  it('stays open while its menu is open', async () => {
    const { user, container } = renderWithQueryEditorProvider(<StackedAddBar variant="query" afterId="A" />);
    const bar = container.querySelector('[data-stacked-add-bar]');

    await user.click(screen.getByRole('button', { name: 'Add below A' }));
    expect(bar).toHaveAttribute('data-open');

    await user.keyboard('{Escape}');
    expect(bar).not.toHaveAttribute('data-open');
  });

  it('transformation bar opens the picker after this transformation', async () => {
    const setPendingTransformation = jest.fn();
    const { user } = renderWithQueryEditorProvider(<StackedAddBar variant="transformation" afterId="organize-0" />, {
      uiStateOverrides: { setPendingTransformation },
    });

    const button = screen.getByRole('button', { name: 'Add transformation below organize-0' });
    expect(button).toHaveTextContent('Add transformation');

    await user.click(button);

    expect(setPendingTransformation).toHaveBeenCalledWith({ insertAfter: 'organize-0' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('tracks adds from the gap', async () => {
    const { user } = renderWithQueryEditorProvider(<StackedAddBar variant="transformation" afterId="organize-0" />);

    await user.click(screen.getByRole('button', { name: 'Add transformation below organize-0' }));

    expect(trackAddTransformationInitiated).toHaveBeenCalledWith('stacked_gap');
  });

  it('renders no add button in multi-select mode', () => {
    const { container } = renderWithQueryEditorProvider(<StackedAddBar variant="query" afterId="A" />, {
      uiStateOverrides: { multiSelectMode: true },
    });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.querySelector('[data-stacked-add-bar]')).toBeInTheDocument();
  });
});
