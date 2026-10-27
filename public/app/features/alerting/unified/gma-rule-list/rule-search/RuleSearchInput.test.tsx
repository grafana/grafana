import { render, screen } from 'test/test-utils';

import { RuleSearchInput } from './RuleSearchInput';
import { alertFilters } from './alertFilters';

function renderInput(query = '') {
  const onApply = jest.fn();
  const view = render(
    <>
      <RuleSearchInput query={query} onApply={onApply} filters={alertFilters} />
      <button>elsewhere</button>
    </>
  );
  return { ...view, onApply, input: screen.getByRole('textbox', { name: 'Search' }) };
}

describe('RuleSearchInput', () => {
  it('applies the draft on Enter, not while typing', async () => {
    const { user, onApply, input } = renderInput();

    await user.type(input, 'cpu');
    expect(onApply).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    expect(onApply.mock.calls).toEqual([['cpu']]);
  });

  it('applies the draft on blur', async () => {
    const { user, onApply, input } = renderInput();

    await user.type(input, 'cpu');
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));

    expect(onApply.mock.calls).toEqual([['cpu']]);
  });

  it('applies an empty query at once when the clear button empties the input', async () => {
    const { user, onApply, input } = renderInput('cpu');

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(input).toHaveValue('');
    expect(onApply.mock.calls).toEqual([['']]);
  });

  it('applies an empty query at once when the applied text is deleted', async () => {
    const { user, onApply, input } = renderInput('cpu');

    await user.type(input, '{Backspace}{Backspace}{Backspace}');

    expect(onApply.mock.calls).toEqual([['']]);
  });

  it('does not apply when text that was never applied is deleted', async () => {
    const { user, onApply, input } = renderInput();

    await user.type(input, 'cp{Backspace}{Backspace}');

    expect(onApply).not.toHaveBeenCalled();
  });

  it('lists each filter with an example in the help, and the values it cannot search yet', async () => {
    const { user } = renderInput();

    await user.click(screen.getByTitle('Search help'));

    expect(screen.getByText('Labels')).toBeInTheDocument();
    expect(screen.getByText('label:team=api')).toBeInTheDocument();
    expect(screen.getAllByText('Available')).toHaveLength(12);
    expect(screen.getByText("Filtering by the default policy isn't available yet.")).toBeInTheDocument();
    expect(screen.getByText("Filtering by not paused isn't available yet.")).toBeInTheDocument();
  });
});
