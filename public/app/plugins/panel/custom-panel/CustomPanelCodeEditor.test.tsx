import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type StandardEditorProps } from '@grafana/data';
import { mockComboboxRect } from '@grafana/test-utils';

import { CustomPanelCodeEditor } from './CustomPanelCodeEditor';
import { getStarterTemplates } from './templates';
import { type Options } from './types';

// Monaco does not run in jsdom; a textarea stands in for it.
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  CodeEditor: ({ value, onBlur }: { value: string; onBlur: (value: string) => void }) => (
    <textarea aria-label="Code" defaultValue={value} onBlur={(event) => onBlur(event.currentTarget.value)} />
  ),
}));

function setup(value: string) {
  const onChange = jest.fn();
  const props = { value, onChange, item: {}, context: { data: [] } } as unknown as StandardEditorProps<
    string,
    {},
    Options
  >;
  render(<CustomPanelCodeEditor {...props} />);
  return { onChange };
}

const blank = () => {
  const template = getStarterTemplates().find((candidate) => candidate.id === 'blank');
  if (!template) {
    throw new Error('missing blank template');
  }
  return template;
};

async function pickBlankTemplate() {
  await userEvent.click(screen.getByRole('combobox', { name: 'Insert template' }));
  await userEvent.click(await screen.findByRole('option', { name: new RegExp(blank().label) }));
}

describe('CustomPanelCodeEditor', () => {
  beforeAll(() => {
    mockComboboxRect();
  });

  it('applies a template directly when there is no code yet', async () => {
    const { onChange } = setup('');
    await pickBlankTemplate();
    expect(onChange).toHaveBeenCalledWith(blank().code);
    expect(screen.queryByText('Replace drawing code?')).not.toBeInTheDocument();
  });

  it('asks before replacing edited code, and keeps it when dismissed', async () => {
    const { onChange } = setup('panel.onRender(() => {});');
    await pickBlankTemplate();
    expect(onChange).not.toHaveBeenCalled();
    expect(await screen.findByText('Replace drawing code?')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('replaces edited code once confirmed', async () => {
    const { onChange } = setup('panel.onRender(() => {});');
    await pickBlankTemplate();
    await userEvent.click(await screen.findByRole('button', { name: 'Replace' }));
    expect(onChange).toHaveBeenCalledWith(blank().code);
  });

  it('commits the code on blur', async () => {
    const { onChange } = setup('');
    const editor = screen.getByLabelText('Code');
    await userEvent.type(editor, 'x');
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith('x');
  });
});
