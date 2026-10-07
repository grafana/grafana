/** @jest-environment-options {"customExportConditions": ["@grafana-app/source", "node", "node-addons"]} */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { DashboardSchemaEditor, type DashboardSchemaEditorProps } from './DashboardSchemaEditor';
import { fetchDashboardSchema } from './dashboardSchemaFetcher';

jest.mock('./dashboardSchemaFetcher', () => ({ fetchDashboardSchema: jest.fn() }));

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
  });

  it('reports current JSON edits and blocks YAML for JSON syntax errors', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const onValidationChange = jest.fn();
    render(<ControlledEditor onChange={onChange} onValidationChange={onValidationChange} />);
    await screen.findByRole('textbox', { name: 'Dashboard schema' });
    await waitFor(() => expect(onValidationChange).toHaveBeenLastCalledWith(false));

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
    expect(onValidationChange).toHaveBeenLastCalledWith(false);
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
    expect(onValidationChange).toHaveBeenLastCalledWith(false);

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
    expect(onValidationChange).toHaveBeenLastCalledWith(false);
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
