import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { readCSV } from '@grafana/data';
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

it('replaces the draft when options change outside of the editor', async () => {
  mockBoundingClientRect();
  const onCommit = jest.fn();
  const { rerender } = render(<StaticOptionsEditor options={[{ text: 'Host', value: 'host' }]} onCommit={onCommit} />);
  const editor = await screen.findByRole('textbox', { name: 'Static dimensions CSV' });

  rerender(<StaticOptionsEditor options={[{ text: 'Region', value: 'region' }]} onCommit={onCommit} />);

  expect(editor).toHaveTextContent('Region,region');
});

it('keeps the draft as typed when committing it changes the options', async () => {
  mockBoundingClientRect();
  const user = userEvent.setup();
  let options = [{ text: 'Host', value: 'host' }];
  const onCommit = jest.fn(() => {
    options = [{ text: 'Region, name', value: 'region' }];
    rerender(<StaticOptionsEditor options={options} onCommit={onCommit} />);
  });
  const { rerender } = render(<StaticOptionsEditor options={options} onCommit={onCommit} />);
  const editor = await screen.findByRole('textbox', { name: 'Static dimensions CSV' });

  await user.click(editor);
  await user.keyboard('{Control>}a{/Control}{Backspace}');
  await user.paste('"Region, name",region');
  await user.click(document.body);

  expect(onCommit).toHaveBeenCalledWith('"Region, name",region');
  expect(editor).toHaveTextContent('"Region, name",region');
});

it.each([
  { text: 'Region, name', value: 'region,code' },
  { text: 'Say "hello"', value: '"quoted"' },
  { text: 'First\nSecond', value: 'line1\nline2' },
])('preserves CSV fields when external options are committed: $text', async (option) => {
  mockBoundingClientRect();
  const user = userEvent.setup();
  const onCommit = jest.fn();
  const { rerender } = render(<StaticOptionsEditor options={[]} onCommit={onCommit} />);
  const editor = await screen.findByRole('textbox', { name: 'Static dimensions CSV' });
  rerender(<StaticOptionsEditor options={[option]} onCommit={onCommit} />);
  await user.click(editor);
  await user.click(document.body);
  const frame = readCSV('key,value\n' + onCommit.mock.calls[0][0])[0];
  expect(frame.fields.map((field) => field.values[0])).toEqual([option.text, option.value]);
});

it('refreshes external options after a commit that does not rerender the parent', async () => {
  mockBoundingClientRect();
  const user = userEvent.setup();
  const onCommit = jest.fn();
  const { rerender } = render(<StaticOptionsEditor options={[{ text: 'Host', value: 'host' }]} onCommit={onCommit} />);
  const editor = await screen.findByRole('textbox', { name: 'Static dimensions CSV' });
  await user.click(editor);
  await user.click(document.body);
  expect(onCommit).toHaveBeenCalledWith('Host,host');
  rerender(<StaticOptionsEditor options={[{ text: 'Region', value: 'region' }]} onCommit={onCommit} />);
  expect(editor).toHaveTextContent('Region,region');
});

it('writes a key without a value as typed, so committing it again does not change the options', async () => {
  mockBoundingClientRect();
  const user = userEvent.setup();
  const parse = (csv: string) => {
    const frame = readCSV('key,value\n' + csv)[0];
    return frame.fields[0].values.map((text, i) => ({ text, value: frame.fields[1].values[i] }));
  };
  let options = parse('host');
  const onCommit = jest.fn((csv: string) => {
    options = parse(csv);
    rerender(<StaticOptionsEditor options={options} onCommit={onCommit} />);
  });
  const { rerender } = render(<StaticOptionsEditor options={options} onCommit={onCommit} />);
  const editor = await screen.findByRole('textbox', { name: 'Static dimensions CSV' });

  expect(editor).toHaveTextContent(/^host$/);
  await user.click(editor);
  await user.click(document.body);

  expect(onCommit).toHaveBeenCalledWith('host');
  expect(options).toEqual(parse('host'));
});
