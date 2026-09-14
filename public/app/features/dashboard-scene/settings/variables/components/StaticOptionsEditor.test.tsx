import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockBoundingClientRect } from '@grafana/test-utils';

import { StaticOptionsEditor } from './StaticOptionsEditor';

it('keeps CSV edits local until blur or Mod-S', async () => {
  mockBoundingClientRect();
  const user = userEvent.setup();
  const onCommit = jest.fn();
  const { rerender } = render(<StaticOptionsEditor options={[]} onCommit={onCommit} />);
  const editor = await screen.findByRole('textbox', { name: 'Static dimensions CSV' });
  const csv = '"Region, name",region\nHost,host';

  await user.click(editor);
  await user.paste(csv);
  rerender(<StaticOptionsEditor options={[]} onCommit={onCommit} />);
  expect(editor).toHaveTextContent('"Region, name",region');
  expect(onCommit).not.toHaveBeenCalled();

  await user.click(document.body);
  expect(onCommit).toHaveBeenCalledWith(csv);

  await user.click(editor);
  await user.keyboard('{Control>}a{/Control}{Backspace}');
  const onKeyDown = jest.fn();
  editor.addEventListener('keydown', onKeyDown);
  await user.keyboard('{Control>}s{/Control}');
  expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: 's', defaultPrevented: true }));
  expect(onCommit).toHaveBeenLastCalledWith('');
  expect(onCommit).toHaveBeenCalledTimes(2);
});
