import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';

import { TransformationsActions } from './TransformationsActions';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const onAddTransformation = jest.fn();
const onDeleteAll = jest.fn();

function renderActions() {
  return render(<TransformationsActions onAddTransformation={onAddTransformation} onDeleteAll={onDeleteAll} />);
}

async function openDeleteConfirmation() {
  await userEvent.click(screen.getByTestId(selectors.components.Transforms.removeAllTransformationsButton));
}

describe('TransformationsActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls onAddTransformation when the add button is clicked', async () => {
    renderActions();

    await userEvent.click(screen.getByTestId(selectors.components.Transforms.addTransformationButton));

    expect(onAddTransformation).toHaveBeenCalledTimes(1);
  });

  it('asks for confirmation before deleting rather than deleting outright', async () => {
    renderActions();

    await openDeleteConfirmation();

    expect(await screen.findByTestId(selectors.pages.ConfirmModal.delete)).toBeInTheDocument();
    expect(onDeleteAll).not.toHaveBeenCalled();
  });

  it('deletes all and reports the interaction once the delete is confirmed', async () => {
    renderActions();

    await openDeleteConfirmation();
    await userEvent.click(await screen.findByTestId(selectors.pages.ConfirmModal.delete));

    expect(onDeleteAll).toHaveBeenCalledTimes(1);
    expect(reportInteraction).toHaveBeenCalledTimes(1);
    expect(reportInteraction).toHaveBeenCalledWith('grafana_panel_transformations_clicked', {
      context: 'transformations_list',
      action: 'delete_all',
    });
  });

  it('keeps the transformations and reports nothing when the delete is dismissed', async () => {
    renderActions();

    await openDeleteConfirmation();
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByTestId(selectors.pages.ConfirmModal.delete)).not.toBeInTheDocument();
    });
    expect(onDeleteAll).not.toHaveBeenCalled();
    expect(reportInteraction).not.toHaveBeenCalled();
  });
});
