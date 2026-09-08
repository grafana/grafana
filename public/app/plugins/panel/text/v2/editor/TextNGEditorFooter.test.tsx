import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TextNGEditorFooter } from './TextNGEditorFooter';

const setup = (showLineNumbers: boolean) => {
  const onShowLineNumbersChange = jest.fn();
  render(<TextNGEditorFooter showLineNumbers={showLineNumbers} onShowLineNumbersChange={onShowLineNumbersChange} />);
  return { onShowLineNumbersChange, toggle: screen.getByRole('switch', { name: 'Line numbers' }) };
};

describe('TextNGEditorFooter', () => {
  it('checks the toggle when line numbers are on', () => {
    expect(setup(true).toggle).toBeChecked();
  });

  it('unchecks the toggle when line numbers are off', () => {
    expect(setup(false).toggle).not.toBeChecked();
  });

  it.each([true, false])('toggles line numbers when they are %s', async (showLineNumbers) => {
    const { onShowLineNumbersChange, toggle } = setup(showLineNumbers);

    await userEvent.click(toggle);

    expect(onShowLineNumbersChange).toHaveBeenCalledWith(!showLineNumbers);
  });
});
