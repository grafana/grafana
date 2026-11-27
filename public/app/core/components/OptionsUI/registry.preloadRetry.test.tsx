import { render, screen } from 'test/test-utils';

import { type StandardEditorsRegistryItem } from '@grafana/data';

import { getAllOptionEditors, preloadOptionEditors } from './registry';

let mockNumberEditorFails = true;
// Stands in for a chunk that fails to load once, e.g. on a network blip.
jest.mock('./number', () => {
  if (mockNumberEditorFails) {
    mockNumberEditorFails = false;
    throw new Error('Loading chunk options-ui-editors-core failed');
  }
  return jest.requireActual('./number');
});

it('loads an editor again after its code failed to load', async () => {
  await expect(preloadOptionEditors()).rejects.toThrow('Loading chunk options-ui-editors-core failed');
  await preloadOptionEditors();

  const number = getAllOptionEditors().find((editor) => editor.id === 'number') as StandardEditorsRegistryItem<number>;
  const Editor = number.editor;
  render(<Editor value={42} onChange={jest.fn()} item={number} context={{ data: [] }} />);

  expect(screen.getByRole('spinbutton')).toHaveValue(42);
});
