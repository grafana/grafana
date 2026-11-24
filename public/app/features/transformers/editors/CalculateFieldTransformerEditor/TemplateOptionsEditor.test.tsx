import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { FieldType, toDataFrame } from '@grafana/data';
import { CalculateFieldMode, type CalculateFieldTransformerOptions } from '@grafana/data/internal';

import { TemplateOptionsEditor } from './TemplateOptionsEditor';

const input = [
  toDataFrame({
    fields: [
      { name: 'host', type: FieldType.string, values: ['a'] },
      { name: 'host.name', type: FieldType.string, values: ['a.example'] },
      { name: 'Value', type: FieldType.number, values: [1], config: { displayName: 'Speed' } },
      { name: 'State', type: FieldType.enum, values: [0] },
    ],
  }),
];

const setup = (template = '', decimals?: number) => {
  const options: CalculateFieldTransformerOptions = {
    mode: CalculateFieldMode.Template,
    template: { template, decimals },
  };
  const onChange = jest.fn();
  render(
    <TemplateOptionsEditor
      options={options}
      onChange={onChange}
      names={['host', 'host.name', 'Speed', '$env']}
      input={input}
    />
  );
  return { onChange };
};

describe('TemplateOptionsEditor', () => {
  it('saves the typed template on blur', async () => {
    const { onChange } = setup();

    await userEvent.type(screen.getByRole('textbox'), 'static text');
    await userEvent.tab();

    expect(onChange).toHaveBeenLastCalledWith({
      mode: CalculateFieldMode.Template,
      template: { template: 'static text' },
    });
  });

  it.each([
    { name: 'host', expected: 'at ${__data.fields.host}' },
    { name: 'host.name', expected: 'at ${__data.fields["host.name"]}' },
  ])('appends a reference to $name when picked from Insert field', async ({ name, expected }) => {
    const { onChange } = setup('at ');

    await selectOptionInTest(screen.getByRole('combobox', { name: 'Insert field' }), name);

    expect(onChange).toHaveBeenCalledWith({
      mode: CalculateFieldMode.Template,
      template: { template: expected },
    });
    expect(screen.getByRole('textbox')).toHaveValue(expected);
  });

  it('inserts the picked field reference at the cursor position', async () => {
    const { onChange } = setup(' end');
    screen.getByRole<HTMLInputElement>('textbox').setSelectionRange(0, 0);

    await selectOptionInTest(screen.getByRole('combobox', { name: 'Insert field' }), 'host');

    expect(onChange).toHaveBeenLastCalledWith({
      mode: CalculateFieldMode.Template,
      template: { template: '${__data.fields.host} end' },
    });
  });

  it('inserts a second field right after the first one', async () => {
    const { onChange } = setup(' end');
    const input = screen.getByRole<HTMLInputElement>('textbox');
    input.setSelectionRange(0, 0);

    await selectOptionInTest(screen.getByRole('combobox', { name: 'Insert field' }), 'host');
    await waitFor(() => expect(input.selectionStart).toBe('${__data.fields.host}'.length));
    await selectOptionInTest(screen.getByRole('combobox', { name: 'Insert field' }), 'host.name');

    expect(onChange).toHaveBeenLastCalledWith({
      mode: CalculateFieldMode.Template,
      template: { template: '${__data.fields.host}${__data.fields["host.name"]} end' },
    });
  });

  it('does not offer dashboard variables as fields', async () => {
    setup();

    await userEvent.click(screen.getByRole('combobox', { name: 'Insert field' }));

    expect(screen.getByText('host.name')).toBeInTheDocument();
    expect(screen.queryByText('$env')).not.toBeInTheDocument();
  });

  it.each([
    { desc: 'a typed number', typed: '4', expected: 4 },
    { desc: 'a fraction rounded down', typed: '3.7', expected: 3 },
    { desc: 'an empty value as automatic', typed: '', expected: undefined },
  ])('saves $desc as decimals on blur', async ({ typed, expected }) => {
    const { onChange } = setup('${__data.fields.host}', 2);
    const input = screen.getByRole('spinbutton');

    await userEvent.clear(input);
    if (typed) {
      await userEvent.type(input, typed);
    }
    await userEvent.tab();

    expect(onChange).toHaveBeenLastCalledWith({
      mode: CalculateFieldMode.Template,
      template: { template: '${__data.fields.host}', decimals: expected },
    });
  });

  it('clamps out-of-range decimals to 15 and shows the range error', async () => {
    const { onChange } = setup('${__data.fields.host}');

    await userEvent.type(screen.getByRole('spinbutton'), '20');
    await userEvent.tab();

    expect(onChange).toHaveBeenLastCalledWith({
      mode: CalculateFieldMode.Template,
      template: { template: '${__data.fields.host}', decimals: 15 },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Out of range. Range: 0 to 15');
  });

  it('lists only references that match no field name, display name or field type', () => {
    setup('${__data.fields.host} ${__data.fields.Value} ${__data.fields.State} ${__data.fields.missing}');

    expect(screen.getByText('Unknown fields: missing')).toBeInTheDocument();
  });
});
