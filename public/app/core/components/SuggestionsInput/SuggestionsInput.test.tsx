import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';

import { VariableOrigin } from '@grafana/data';

import { SuggestionsInput } from './SuggestionsInput';

const suggestions = [{ value: 't', label: 't', origin: VariableOrigin.Template }];

describe('SuggestionsInput', () => {
  it('commits on blur and when a suggestion is picked, not on every edit', async () => {
    const onChange = jest.fn();
    render(<SuggestionsInput value="" onChange={onChange} suggestions={suggestions} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '1');
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.type(input, '$');
    await userEvent.click(await screen.findByText('t'));
    expect(onChange).toHaveBeenLastCalledWith('1${t}');

    await userEvent.tab();
    expect(onChange).toHaveBeenLastCalledWith('1${t}');
  });

  it('reports every edit through onInputChange and passes through label, ref, prefix and suffix', async () => {
    const onInputChange = jest.fn();
    const inputRef = createRef<HTMLInputElement>();
    function Controlled() {
      const [text, setText] = useState('');
      return (
        <SuggestionsInput
          value={text}
          onChange={jest.fn()}
          onInputChange={(value) => {
            onInputChange(value);
            setText(value);
          }}
          suggestions={suggestions}
          aria-label="Threshold 1"
          inputRef={inputRef}
          prefix={<span>before</span>}
          suffix={<span>after</span>}
        />
      );
    }
    render(<Controlled />);

    const input = screen.getByRole('textbox', { name: 'Threshold 1' });
    await userEvent.type(input, '42');

    expect(onInputChange).toHaveBeenNthCalledWith(1, '4');
    expect(onInputChange).toHaveBeenLastCalledWith('42');
    expect(inputRef.current).toBe(input);
    expect(screen.getByText('before')).toBeInTheDocument();
    expect(screen.getByText('after')).toBeInTheDocument();
  });

  it('commits once when a suggestion is clicked, without the half-typed text first', async () => {
    const onChange = jest.fn();
    render(<SuggestionsInput value="" onChange={onChange} suggestions={suggestions} />);

    await userEvent.type(screen.getByRole('textbox'), '$');
    await userEvent.click(await screen.findByText('t'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('${t}');
  });

  it('narrows the list to what is typed after $, and Enter only picks a match', async () => {
    const onChange = jest.fn();
    const twoSuggestions = [
      { value: 'min', label: 'min', origin: VariableOrigin.Template },
      { value: 'other', label: 'other', origin: VariableOrigin.Template },
    ];
    render(<SuggestionsInput value="" onChange={onChange} suggestions={twoSuggestions} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '$ot');
    expect(screen.queryByText('min')).not.toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('${other}');

    await userEvent.clear(input);
    await userEvent.type(input, '$zz');
    expect(screen.queryByText('other')).not.toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(input).toHaveValue('$zz');
  });

  it('shows the value passed in with onInputChange, also when the caller replaces the text', async () => {
    const onChange = jest.fn();
    const onInputChange = jest.fn();
    const { rerender } = render(
      <SuggestionsInput value="5" onChange={onChange} onInputChange={onInputChange} suggestions={suggestions} />
    );

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '$');
    await userEvent.click(await screen.findByText('t'));
    expect(onInputChange).toHaveBeenLastCalledWith('5${t}');
    expect(onChange).toHaveBeenLastCalledWith('5${t}');

    rerender(
      <SuggestionsInput value="7" onChange={onChange} onInputChange={onInputChange} suggestions={suggestions} />
    );
    expect(input).toHaveValue('7');
    expect(input).toHaveFocus();
  });

  it('narrows the list by what is typed up to the cursor, including dots', async () => {
    const dataSuggestions = [
      { value: '__data.fields', label: '__data.fields', origin: VariableOrigin.Template },
      { value: '__data.refId', label: '__data.refId', origin: VariableOrigin.Template },
    ];
    render(<SuggestionsInput value="" onChange={jest.fn()} suggestions={dataSuggestions} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'suffix');
    await userEvent.type(input, '$__data.fi', { initialSelectionStart: 0, initialSelectionEnd: 0 });
    expect(input).toHaveValue('$__data.fisuffix');
    expect(screen.getByText('__data.fields')).toBeInTheDocument();
    expect(screen.queryByText('__data.refId')).not.toBeInTheDocument();
  });

  it('lists the exact match first, then names that start with what is typed', async () => {
    const onChange = jest.fn();
    const names = ['admin', 'minimum', 'min'].map((value) => ({
      value,
      label: value,
      origin: VariableOrigin.Template,
    }));
    render(<SuggestionsInput value="" onChange={onChange} suggestions={names} />);

    await userEvent.type(screen.getByRole('textbox'), '$min');
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent(/\bmin$/);
    expect(items[1]).toHaveTextContent(/minimum$/);
    expect(items[2]).toHaveTextContent(/admin$/);
    await userEvent.keyboard('{Enter}');

    expect(onChange).toHaveBeenLastCalledWith('${min}');
  });

  it('picks the highlighted suggestion when the matches come from several origins', async () => {
    const onChange = jest.fn();
    render(
      <SuggestionsInput
        value=""
        onChange={onChange}
        suggestions={[
          { value: 'admin', label: 'admin', origin: VariableOrigin.Template },
          { value: 'minimum', label: 'minimum', origin: VariableOrigin.Series },
          { value: 'min', label: 'min', origin: VariableOrigin.Template },
        ]}
      />
    );

    // Shown grouped by origin: min and admin, then minimum
    await userEvent.type(screen.getByRole('textbox'), '$min{ArrowDown}');
    const items = screen.getAllByRole('menuitem');
    expect(items[1]).toHaveTextContent(/admin$/);
    await userEvent.keyboard('{Enter}');

    expect(onChange).toHaveBeenLastCalledWith('${admin}');
  });

  describe('keeps the list open only while a variable name is typed', () => {
    const names = (...values: string[]) =>
      values.map((value) => ({ value, label: value, origin: VariableOrigin.Template }));

    it('keeps it open through Backspace, so the name can be corrected', async () => {
      const onChange = jest.fn();
      render(<SuggestionsInput value="" onChange={onChange} suggestions={names('dsA', 'other')} />);

      await userEvent.type(screen.getByRole('textbox'), '$ds{Backspace}s');
      expect(screen.getByText('dsA')).toBeInTheDocument();
      await userEvent.keyboard('{Enter}');

      expect(onChange).toHaveBeenLastCalledWith('${dsA}');
    });

    it('closes it when the $ is deleted', async () => {
      render(<SuggestionsInput value="" onChange={jest.fn()} suggestions={names('dsA')} />);

      await userEvent.type(screen.getByRole('textbox'), '$d{Backspace}{Backspace}');

      expect(screen.queryByText('dsA')).not.toBeInTheDocument();
    });

    it('closes it on blur, so a later edit does not bring it back', async () => {
      const onChange = jest.fn();
      render(<SuggestionsInput value="" onChange={onChange} suggestions={names('warn')} />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, '$zz');
      await userEvent.tab();
      await userEvent.click(input);
      await userEvent.keyboard('{Control>}a{/Control}w');
      expect(screen.queryByText('warn')).not.toBeInTheDocument();
      await userEvent.keyboard('{Enter}');

      expect(input).toHaveValue('w');
    });

    it('closes it at a character that cannot be in a name, so Enter keeps the rest of the text', async () => {
      render(<SuggestionsInput value="" onChange={jest.fn()} suggestions={names('foo')} />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, '$foo-$bar{Enter}');

      expect(input).toHaveValue('$foo-$bar');
    });
  });
});
