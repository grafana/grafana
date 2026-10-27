import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { FieldType, type TypedVariableModel } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { numberOrVariableValidator } from '../../utils';

import { rangeMatcherEditor } from './RangeMatcherEditor';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: jest.fn(),
}));

describe('RangeMatcherEditor', () => {
  beforeEach(() => {
    jest.mocked(getTemplateSrv).mockReturnValue(new TemplateSrv());
  });

  it.each(['from', 'to'] as const)('renders an opted-in open %s bound as a valid empty input', (bound) => {
    const Editor = rangeMatcherEditor({ validator: numberOrVariableValidator });
    render(
      <Editor
        options={bound === 'from' ? { to: 10, allowOpenBounds: true } : { from: 1, allowOpenBounds: true }}
        field={{ name: 'Value', type: FieldType.number, config: {}, values: [] }}
        onChange={jest.fn()}
      />
    );

    const openInput = screen.getByPlaceholderText(bound === 'from' ? 'From' : 'To');
    expect(openInput).toHaveValue('');
    expect(openInput).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByPlaceholderText(bound === 'from' ? 'To' : 'From')).toHaveValue(bound === 'from' ? '10' : '1');
  });

  it.each(['from', 'to'] as const)('renders a missing %s bound as empty and invalid without opt-in', (bound) => {
    const Editor = rangeMatcherEditor({ validator: numberOrVariableValidator });
    render(
      <Editor
        options={bound === 'from' ? { to: 10 } : { from: 1 }}
        field={{ name: 'Value', type: FieldType.number, config: {}, values: [] }}
        onChange={jest.fn()}
      />
    );

    const missingInput = screen.getByPlaceholderText(bound === 'from' ? 'From' : 'To');
    expect(missingInput).toHaveValue('');
    expect(missingInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByPlaceholderText(bound === 'from' ? 'To' : 'From')).toHaveValue(bound === 'from' ? '10' : '1');
  });

  it.each(['from', 'to'] as const)('clears the opted-in %s bound to undefined', async (bound) => {
    const Editor = rangeMatcherEditor({ validator: numberOrVariableValidator });
    const onChange = jest.fn();
    render(
      <Editor
        options={{ from: 1, to: 10, allowOpenBounds: true, inclusive: true }}
        field={{ name: 'Value', type: FieldType.number, config: {}, values: [] }}
        onChange={onChange}
      />
    );

    const input = screen.getByPlaceholderText(bound === 'from' ? 'From' : 'To');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(
        bound === 'from'
          ? { from: undefined, to: 10, allowOpenBounds: true, inclusive: true }
          : { from: 1, to: undefined, allowOpenBounds: true, inclusive: true }
      )
    );
  });

  it('preserves the empty string when open bounds are not enabled', async () => {
    const Editor = rangeMatcherEditor({ validator: numberOrVariableValidator });
    const onChange = jest.fn();
    render(
      <Editor
        options={{ from: 1, to: 10 }}
        field={{ name: 'Value', type: FieldType.number, config: {}, values: [] }}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('From'), { target: { value: '' } });
    fireEvent.blur(screen.getByPlaceholderText('From'));

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ from: '', to: 10 }));
  });

  it('shows variable suggestions for both from and to inputs', async () => {
    // Mock template service variables
    const mockVariables: TypedVariableModel[] = [
      { name: 'var1', label: 'Variable 1', type: 'custom' } as TypedVariableModel,
      { name: 'var2', label: 'Variable 2', type: 'custom' } as TypedVariableModel,
    ];

    const mockTemplateSrv = {
      getVariables: () => mockVariables,
      replace: jest.fn(),
      containsTemplate: jest.fn(),
      updateTimeRange: jest.fn(),
    };

    jest.mocked(getTemplateSrv).mockReturnValue(mockTemplateSrv);

    const onChangeMock = jest.fn();
    const options = { from: '', to: '' };
    const field = {
      name: 'test',
      type: FieldType.string,
      config: {},
      values: [],
    };

    const Editor = rangeMatcherEditor({ validator: () => true });
    render(<Editor options={options} onChange={onChangeMock} field={field} />);

    // Test "from" input
    const fromInput = screen.getByPlaceholderText('From');
    fireEvent.focus(fromInput);
    fireEvent.keyDown(fromInput, { key: '$' });

    // Wait for suggestions to appear and verify for "from" input
    await waitFor(() => {
      const menus = screen.getAllByRole('menu');
      const fromMenu = menus[0]; // First menu is for the "from" input
      const fromSuggestions = fromMenu.querySelectorAll('[role="menuitem"]');
      // Verify exact number of suggestions for "from" input
      expect(fromSuggestions).toHaveLength(mockVariables.length);

      mockVariables.forEach((variable) => {
        const suggestion = Array.from(fromSuggestions).find((s) => s.textContent?.includes(variable.label as string));
        expect(suggestion).toBeInTheDocument();
      });
    });

    // Clear suggestions
    fireEvent.blur(fromInput);

    // Test "to" input
    const toInput = screen.getByPlaceholderText('To');
    fireEvent.focus(toInput);
    fireEvent.keyDown(toInput, { key: '$' });

    // Wait for suggestions to appear and verify for "to" input
    await waitFor(() => {
      const menus = screen.getAllByRole('menu');
      const toMenu = menus[1];
      const toSuggestions = toMenu.querySelectorAll('[role="menuitem"]');
      // Verify exact number of suggestions for "to" input
      expect(toSuggestions).toHaveLength(mockVariables.length);

      mockVariables.forEach((variable) => {
        const suggestion = Array.from(toSuggestions).find((s) => s.textContent?.includes(variable.label as string));
        expect(suggestion).toBeInTheDocument();
      });
    });
  });
});
