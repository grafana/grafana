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
});
