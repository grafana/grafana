import { render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { userEvent } from 'test/test-utils';

import { CustomVariable, SceneVariableSet } from '@grafana/scenes';
import { mockComboboxRect } from '@grafana/test-utils';

import { activateFullSceneTree } from '../../../utils/test-utils';
import { DashboardScene } from '../../DashboardScene';

import { RowOptionsModal } from './RowOptionsModal';

function renderRowOptions() {
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    meta: {
      canEdit: true,
    },
    $variables: new SceneVariableSet({
      variables: [
        new CustomVariable({
          name: 'testVar',
          query: 'a,b',
          value: 'a',
          text: 'a',
        }),
      ],
    }),
  });

  activateFullSceneTree(scene);

  const onDismiss = jest.fn();
  const user = userEvent.setup();

  function Harness() {
    const [open, setOpen] = useState(true);
    if (!open) {
      return null;
    }

    return (
      <TestProvider>
        <RowOptionsModal
          title="Row 1"
          parent={scene}
          onDismiss={() => {
            onDismiss();
            setOpen(false);
          }}
          onUpdate={jest.fn()}
          isUsingDashboardDS={false}
        />
      </TestProvider>
    );
  }

  render(<Harness />);
  return { user, onDismiss };
}

describe('RowOptionsModal', () => {
  beforeAll(() => {
    mockComboboxRect();
  });

  it('closes only Repeat for on Escape and keeps Row options open', async () => {
    const { user, onDismiss } = renderRowOptions();

    const dialog = screen.getByRole('dialog', { name: 'Row options' });
    expect(dialog).toBeInTheDocument();

    // Modal auto-focuses the close button on open — wait for focus to settle
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus());

    const combobox = screen.getByRole('combobox', { name: 'Repeat for' });
    await user.click(combobox);

    expect(await screen.findByRole('option', { name: 'testVar' })).toBeInTheDocument();
    expect(combobox).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('option', { name: 'testVar' })).not.toBeInTheDocument();
    });
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(combobox).toHaveFocus();
    expect(dialog).toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('closes Row options on Escape when Repeat for is not open', async () => {
    const { user, onDismiss } = renderRowOptions();

    expect(screen.getByRole('dialog', { name: 'Row options' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus());

    await user.keyboard('{Escape}');

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Row options' })).not.toBeInTheDocument();
  });

  it('closes Row options on a second Escape after Repeat for closes', async () => {
    const { user, onDismiss } = renderRowOptions();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus());

    const combobox = screen.getByRole('combobox', { name: 'Repeat for' });
    await user.click(combobox);
    expect(await screen.findByRole('option', { name: 'testVar' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('option', { name: 'testVar' })).not.toBeInTheDocument();
    });
    expect(onDismiss).not.toHaveBeenCalled();
    expect(combobox).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Row options' })).not.toBeInTheDocument();
  });
});
