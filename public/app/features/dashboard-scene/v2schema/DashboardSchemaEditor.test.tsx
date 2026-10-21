import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { draft07Config } from 'json-schema-library';
import { useState } from 'react';
import { useAsync } from 'react-use';

import { DashboardSchemaEditor, type DashboardSchemaEditorProps } from './DashboardSchemaEditor';
import { fetchDashboardSchema } from './dashboardSchemaFetcher';

jest.mock('./dashboardSchemaFetcher', () => ({ fetchDashboardSchema: jest.fn() }));
jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useAsync: jest.fn(jest.requireActual('react-use').useAsync),
}));

// Shiki's ESM/WASM tooltip renderer cannot run in Jest's CommonJS environment.
jest.mock(require.resolve('codemirror-json-schema').replace('index.js', 'utils/markdown.js'), () => ({
  renderMarkdown: (text: string) => text,
}));

const schema = {
  type: 'object',
  required: ['spec'],
  properties: { spec: { type: 'object', required: ['title'], properties: { title: { type: 'string' } } } },
};
const initialValue = '{"spec":{"title":"Original"}}';

function ControlledEditor({ onChange, ...props }: Partial<DashboardSchemaEditorProps>) {
  const [value, setValue] = useState(initialValue);
  return (
    <DashboardSchemaEditor
      {...props}
      value={value}
      showFormatToggle
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

async function replaceBuffer(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(await screen.findByRole('textbox', { name: 'Dashboard schema' }));
  await user.keyboard('{Control>}a{/Control}');
  await user.paste(text);
}

describe('DashboardSchemaEditor with CodeMirror', () => {
  beforeEach(() => {
    jest.mocked(fetchDashboardSchema).mockResolvedValue(schema);
    jest.mocked(useAsync).mockImplementation(jest.requireActual('react-use').useAsync);
  });

  it.each(['JSON', 'YAML'])('validates %s once after typing pauses and blocks saving while pending', async (format) => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onValidationChange = jest.fn();
    const { unmount } = render(<ControlledEditor onValidationChange={onValidationChange} />);
    const validate = jest.spyOn(draft07Config, 'validate');
    try {
      await screen.findByRole('textbox', { name: 'Dashboard schema' });
      if (format === 'YAML') {
        await user.click(screen.getByRole('radio', { name: 'YAML' }));
      }
      await waitFor(() => expect(onValidationChange).toHaveBeenLastCalledWith(false));
      await act(async () => jest.advanceTimersByTime(100));
      validate.mockClear();

      await replaceBuffer(user, format === 'JSON' ? '{"spec":{"title":123}}' : 'spec:\n  title: 123');
      await act(async () => jest.advanceTimersByTime(5));
      await replaceBuffer(user, format === 'JSON' ? '{"spec":{"title":"Edited"}}' : 'spec:\n  title: Edited');
      expect(onValidationChange).toHaveBeenLastCalledWith(true);
      expect(validate).not.toHaveBeenCalled();

      // CodeMirror's linter allows a 10 ms scheduling tolerance.
      await act(async () => jest.advanceTimersByTime(100));
      expect(validate.mock.calls.filter(([, , , pointer]) => pointer === '#')).toHaveLength(1);
      expect(onValidationChange).toHaveBeenLastCalledWith(false);
      await act(async () => jest.advanceTimersByTime(200));
      expect(validate.mock.calls.filter(([, , , pointer]) => pointer === '#')).toHaveLength(1);
    } finally {
      unmount();
      jest.runOnlyPendingTimers();
      validate.mockRestore();
      jest.useRealTimers();
    }
  });

  it('shows a read-only buffer and an error when schema support fails to load', async () => {
    jest.mocked(useAsync).mockReturnValue({ loading: false, error: new Error('Loading chunk failed') });
    const user = userEvent.setup();
    const onChange = jest.fn();
    const onValidationChange = jest.fn();
    render(<ControlledEditor onChange={onChange} onValidationChange={onValidationChange} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load dashboard schema validation');
    const editor = await screen.findByRole('textbox', { name: 'Dashboard schema' });
    expect(editor).toHaveAttribute('aria-readonly', 'true');
    expect(screen.getByRole('radio', { name: 'YAML' })).toBeDisabled();
    await user.click(editor);
    await user.keyboard('changed');
    expect(editor).toHaveTextContent(initialValue);
    expect(onChange).not.toHaveBeenCalled();
    expect(onValidationChange).toHaveBeenLastCalledWith(true);
  });

  it('reports current JSON edits and blocks YAML for JSON syntax errors', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const onValidationChange = jest.fn();
    render(<ControlledEditor onChange={onChange} onValidationChange={onValidationChange} />);
    await screen.findByRole('textbox', { name: 'Dashboard schema' });
    await waitFor(() => expect(onValidationChange).toHaveBeenLastCalledWith(false));

    await replaceBuffer(user, initialValue);
    expect(onValidationChange).toHaveBeenLastCalledWith(false);

    await replaceBuffer(user, '{"spec":{"title":123}}');
    expect(onChange).toHaveBeenLastCalledWith('{"spec":{"title":123}}');
    expect(onValidationChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('radio', { name: 'YAML' })).toBeEnabled();

    await replaceBuffer(user, '{');
    expect(onChange).toHaveBeenLastCalledWith('{');
    expect(onValidationChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('radio', { name: 'YAML' })).toBeDisabled();

    await replaceBuffer(user, '{"spec":{"title":"Edited"}}');
    expect(onChange).toHaveBeenLastCalledWith('{"spec":{"title":"Edited"}}');
    await waitFor(() => expect(onValidationChange).toHaveBeenLastCalledWith(false));
    expect(screen.getByRole('radio', { name: 'YAML' })).toBeEnabled();
  });

  it('preserves the YAML draft, emits JSON, and recovers from invalid YAML', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const onValidationChange = jest.fn();
    const onParseErrorChange = jest.fn();
    render(
      <ControlledEditor
        onChange={onChange}
        onValidationChange={onValidationChange}
        onParseErrorChange={onParseErrorChange}
      />
    );
    await screen.findByRole('textbox', { name: 'Dashboard schema' });
    await user.click(screen.getByRole('radio', { name: 'YAML' }));

    const draft = '# My comment\nspec:\n  title: Edited';
    await replaceBuffer(user, draft);
    expect(onChange).toHaveBeenLastCalledWith('{\n  "spec": {\n    "title": "Edited"\n  }\n}');
    expect(screen.getByRole('textbox', { name: 'Dashboard schema' })).toHaveTextContent('# My comment');
    await waitFor(() => expect(onValidationChange).toHaveBeenLastCalledWith(false));

    onChange.mockClear();
    await replaceBuffer(user, 'spec: [');
    expect(onValidationChange).toHaveBeenLastCalledWith(true);
    expect(onParseErrorChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('radio', { name: 'JSON' })).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();

    await replaceBuffer(user, 'spec:\n  title: 123');
    expect(onChange).toHaveBeenLastCalledWith('{\n  "spec": {\n    "title": 123\n  }\n}');
    expect(onValidationChange).toHaveBeenLastCalledWith(true);
    expect(onParseErrorChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('radio', { name: 'JSON' })).toBeEnabled();

    await replaceBuffer(user, draft);
    await user.click(screen.getByRole('radio', { name: 'JSON' }));
    expect(screen.getByRole('textbox', { name: 'Dashboard schema' })).toHaveTextContent('"title": "Edited"');
    await waitFor(() => expect(onValidationChange).toHaveBeenLastCalledWith(false));
  });

  it('validates external values while a diff replaces the editor', async () => {
    const onValidationChange = jest.fn();
    const { rerender } = render(
      <DashboardSchemaEditor
        value={initialValue}
        contentOverride={<div>Dashboard diff</div>}
        onValidationChange={onValidationChange}
      />
    );
    expect(await screen.findByText('Dashboard diff')).toBeInTheDocument();
    await waitFor(() => expect(onValidationChange).toHaveBeenLastCalledWith(false));

    rerender(
      <DashboardSchemaEditor
        value='{"spec":{"title":123}}'
        contentOverride={<div>Dashboard diff</div>}
        onValidationChange={onValidationChange}
      />
    );
    expect(screen.getByText('Dashboard diff')).toBeInTheDocument();
    expect(onValidationChange).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole('textbox', { name: 'Dashboard schema' })).not.toBeInTheDocument();
  });

  it('keeps a read-only buffer unchanged during typing', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<ControlledEditor readOnly onChange={onChange} />);
    const editor = await screen.findByRole('textbox', { name: 'Dashboard schema' });
    expect(editor).toHaveAttribute('aria-readonly', 'true');
    await user.click(editor);
    await user.keyboard('changed');
    expect(editor).toHaveTextContent(initialValue);
    expect(onChange).not.toHaveBeenCalled();
  });
});
