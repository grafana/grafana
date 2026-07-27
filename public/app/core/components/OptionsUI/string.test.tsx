import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StringValueEditor } from './string';

describe('StringValueEditor', () => {
  const defaultItem = { settings: {} } as Parameters<typeof StringValueEditor>[0]['item'];
  const emptyContext = { data: [] };

  it('trims on blur and calls onChange', () => {
    const onChange = jest.fn();
    render(<StringValueEditor value="hello" onChange={onChange} item={defaultItem} context={emptyContext} id="s1" />);

    const input = screen.getByRole('textbox');
    fireEvent.blur(input, { target: { value: '  spaced  ' } });

    expect(onChange).toHaveBeenCalledWith('spaced');
  });

  it('sets undefined when trimmed value is empty', () => {
    const onChange = jest.fn();
    render(<StringValueEditor value="x" onChange={onChange} item={defaultItem} context={emptyContext} id="s2" />);

    const input = screen.getByRole('textbox');
    fireEvent.blur(input, { target: { value: '   ' } });

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('does not call onChange when value is unchanged after trim', () => {
    const onChange = jest.fn();
    render(<StringValueEditor value="same" onChange={onChange} item={defaultItem} context={emptyContext} id="s3" />);

    const input = screen.getByRole('textbox');
    fireEvent.blur(input, { target: { value: 'same' } });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('on Enter trims and commits for single-line input', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<StringValueEditor value="" onChange={onChange} item={defaultItem} context={emptyContext} id="s4" />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'hello{Enter}');

    expect(onChange).toHaveBeenCalledWith('hello');
  });

  it('uses textarea when useTextarea is set and does not commit on Enter alone from key path for multiline', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <StringValueEditor
        value=""
        onChange={onChange}
        item={{ settings: { useTextarea: true, rows: 3 } } as Parameters<typeof StringValueEditor>[0]['item']}
        context={emptyContext}
        id="s5"
      />
    );

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'line1{Enter}');

    // For textarea, Enter does not apply the same key handler branch (only non-Enter returns early)
    expect(onChange).not.toHaveBeenCalled();
  });
});
