import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';

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
    render(
      <SuggestionsInput
        value=""
        onChange={jest.fn()}
        onInputChange={onInputChange}
        suggestions={suggestions}
        aria-label="Threshold 1"
        inputRef={inputRef}
        prefix={<span>before</span>}
        suffix={<span>after</span>}
      />
    );

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
});
