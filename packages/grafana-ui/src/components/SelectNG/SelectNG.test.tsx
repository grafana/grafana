import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SelectNG } from './SelectNG';
import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { act } from '@testing-library/react-hooks';

const fakeOptions: Array<SelectableValue<string>> = [
  {
    value: 'opt1',
    label: 'Option 1',
  },
  {
    value: 'opt2',
    label: 'Option 2',
  },
  {
    value: 'opt3',
    label: 'Option 3',
  },
];
const fakeOnChangeHandler = () => {};
describe('Select', () => {
  describe('props', () => {
    test('isOpen', async () => {
      render(<SelectNG options={fakeOptions} onChange={fakeOnChangeHandler} isOpen />);
      await waitFor(() => screen.getByLabelText(selectors.components.Select.menu));

      const menu = screen.getByLabelText(selectors.components.Select.menu);
      const menuOptions = screen.getAllByLabelText(selectors.components.Select.option);

      expect(menu).toBeDefined();
      expect(menuOptions).toHaveLength(3);
    });
  });
  it('renders options when open', async () => {
    render(<SelectNG options={fakeOptions} onChange={fakeOnChangeHandler} />);
    const trigger = screen.getByLabelText(selectors.components.Select.trigger);
    //  Should use toBeInDocument instead
    expect(trigger).toBeDefined();

    fireEvent.click(trigger);
    await waitFor(() => screen.getByLabelText(selectors.components.Select.menu));

    const menu = screen.getByLabelText(selectors.components.Select.menu);
    const menuOptions = screen.getAllByLabelText(selectors.components.Select.option);
    expect(menu).toBeDefined();
    expect(menuOptions).toHaveLength(3);
  });
});
