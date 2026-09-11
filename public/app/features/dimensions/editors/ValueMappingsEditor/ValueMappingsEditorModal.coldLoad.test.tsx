import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { MappingType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { ValueMappingsEditorModal } from './ValueMappingsEditorModal';

type DndModule = typeof import('@hello-pangea/dnd');

const mockDndImportStarted = jest.fn();
let resolveDndModule: (module: DndModule) => void;
const mockDndModulePromise = new Promise<DndModule>((resolve) => {
  resolveDndModule = resolve;
});

jest.mock('@hello-pangea/dnd', () => {
  mockDndImportStarted();

  // Preserve the promise through import interop without replacing the real DnD components.
  return Object.assign(mockDndModulePromise, { __esModule: true });
});

// Keep this cold-load scenario in its own suite so another test cannot warm the hook's module cache.
it('waits for DnD before focusing the initial mapping, saves keyboard input, and focuses an added row', async () => {
  const user = userEvent.setup();
  const onChange = jest.fn();
  const { baseElement } = render(<ValueMappingsEditorModal value={[]} onChange={onChange} onClose={jest.fn()} />);

  await waitFor(() => expect(mockDndImportStarted).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument();
  expect(screen.queryByPlaceholderText('Exact value to match')).not.toBeInTheDocument();

  await act(async () => {
    resolveDndModule(jest.requireActual<DndModule>('@hello-pangea/dnd'));
    await mockDndModulePromise;
  });

  const initialInput = await screen.findByPlaceholderText('Exact value to match');
  await waitFor(() => expect(initialInput).toHaveFocus());
  expect(baseElement.querySelectorAll('[data-rfd-drag-handle-draggable-id]')).toHaveLength(1);

  await user.keyboard('first');
  expect(initialInput).toHaveValue('first');

  await user.click(screen.getByTestId(selectors.components.ValuePicker.button('Add a new mapping')));
  const selectComponent = await screen.findByTestId(selectors.components.ValuePicker.select('Add a new mapping'));
  await selectOptionInTest(selectComponent, 'Value');

  const addedInput = screen.getAllByPlaceholderText('Exact value to match')[1];
  await waitFor(() => expect(addedInput).toHaveFocus());
  await user.keyboard('second');
  expect(addedInput).toHaveValue('second');
  expect(initialInput).toHaveValue('first');

  await user.click(screen.getByRole('button', { name: 'Update' }));
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith([
    {
      type: MappingType.ValueToText,
      options: {
        first: { index: 0, text: undefined },
        second: { index: 1, text: undefined },
      },
    },
  ]);
});
