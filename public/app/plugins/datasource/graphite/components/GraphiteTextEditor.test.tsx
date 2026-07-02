import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { actions } from '../state/actions';

import { GraphiteTextEditor } from './GraphiteTextEditor';

const mockDispatch = jest.fn();

jest.mock('../state/context', () => ({
  useDispatch: () => mockDispatch,
}));

describe('GraphiteTextEditor', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
  });

  it('renders the current query', async () => {
    render(<GraphiteTextEditor rawQuery="app.requests.count" />);

    expect(await screen.findByText('app.requests.count')).toBeInTheDocument();
  });

  it('shows a placeholder when the query is empty', async () => {
    render(<GraphiteTextEditor rawQuery="" />);

    expect(await screen.findByText('Enter a Graphite query (run with Shift+Enter)')).toBeInTheDocument();
  });

  it('propagates edits with a debounce', async () => {
    const user = userEvent.setup();
    render(<GraphiteTextEditor rawQuery="" />);

    await user.click(await screen.findByRole('textbox'));
    await user.keyboard('abc');

    // The update is debounced, so it must not fire on every keystroke.
    expect(mockDispatch).not.toHaveBeenCalled();

    await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith(actions.updateQuery({ query: 'abc' })), {
      timeout: 2000,
    });
  });

  it('runs the query on Shift+Enter, flushing the pending edit first', async () => {
    const user = userEvent.setup();
    render(<GraphiteTextEditor rawQuery="" />);

    await user.click(await screen.findByRole('textbox'));
    await user.keyboard('abc');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(mockDispatch).toHaveBeenCalledWith(actions.updateQuery({ query: 'abc' }));
    expect(mockDispatch).toHaveBeenCalledWith(actions.runQuery());

    const dispatchedTypes = mockDispatch.mock.calls.map(([action]) => action.type);
    expect(dispatchedTypes.indexOf(actions.updateQuery.type)).toBeLessThan(
      dispatchedTypes.indexOf(actions.runQuery.type)
    );
  });

  it('runs the query on Ctrl+Enter', async () => {
    const user = userEvent.setup();
    render(<GraphiteTextEditor rawQuery="app.requests.count" />);

    await user.click(await screen.findByRole('textbox'));
    await user.keyboard('{Control>}{Enter}{/Control}');

    expect(mockDispatch).toHaveBeenCalledWith(actions.runQuery());
  });

  it('runs the query on blur, flushing the pending edit first', async () => {
    const user = userEvent.setup();
    render(<GraphiteTextEditor rawQuery="" />);

    const editor = await screen.findByRole('textbox');
    await user.click(editor);
    await user.keyboard('abc');
    fireEvent.blur(editor);

    expect(mockDispatch).toHaveBeenCalledWith(actions.updateQuery({ query: 'abc' }));
    expect(mockDispatch).toHaveBeenCalledWith(actions.runQuery());
  });
});
