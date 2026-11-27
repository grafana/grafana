import { render, screen } from 'test/test-utils';

import { type StandardEditorsRegistryItem } from '@grafana/data';

import { areOptionEditorsPreloaded, getAllOptionEditors, preloadOptionEditors } from './registry';

// In a file of its own: once any test renders a lazy editor, lazy() would render that editor in full anyway.
it('renders a lazily loaded editor in full on its first render once the editors are preloaded', async () => {
  expect(areOptionEditorsPreloaded()).toBe(false);
  await preloadOptionEditors();
  expect(areOptionEditorsPreloaded()).toBe(true);

  const number = getAllOptionEditors().find((editor) => editor.id === 'number') as StandardEditorsRegistryItem<number>;
  const Editor = number.editor;
  render(<Editor value={42} onChange={jest.fn()} item={number} context={{ data: [] }} />);

  // Read straight after the render, without waiting, as a card holding the editor is measured.
  expect(screen.getByRole('spinbutton')).toHaveValue(42);
});
