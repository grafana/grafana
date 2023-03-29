import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { Input } from '../Input/Input';

import { AutoSaveField, Props } from './AutoSaveField';

const setup = (propOverrides?: Partial<Props>) => {
  const props: Omit<Props, 'children'> = {
    label: 'Test',
    onFinishChange: jest.fn(),
    htmlFor: 'input-test',
  };

  Object.assign(props, propOverrides);

  render(<AutoSaveField {...props}>{(onChange) => <Input id="input-test" name="input-test" />}</AutoSaveField>);
};

/* 
Cases to cover:
1.- General:
  a) It renders
  b) It has a children
  c) It has a onFinishChange function
  d) If success, the InlineToast renders on the right
  e) If success but not enough space, the InlineToas renders on the bottom
2.- Per child:
  a) It renders
  b) When it is succesful, it show the InlineToast saying Saved!
  c) When there was an error, show the error message
  d) When there was an error and the child has an invalid prop, show the red border
*/

describe('AutoSaveField ', () => {
  it('renders with an Input as a children', () => {
    setup();
    expect(
      screen.getByRole('textbox', {
        name: 'input-test',
      })
    ).toBeInTheDocument();
  });
  it('triggers the function on change by typing', async () => {
    const customFn = jest.fn();
    const childValue = '';
    render(
      <AutoSaveField label="AutoSaveField label test" onFinishChange={customFn}>
        {(onChange) => (
          <Input
            label="input test"
            name="input-test"
            value={childValue}
            onChange={(e) => {
              onChange(e.currentTarget.value);
            }}
          />
        )}
      </AutoSaveField>
    );

    await userEvent.type(screen.getByRole('textbox'), 'This is a test text');
    expect(screen.getByRole('textbox')).toHaveTextContent(/test text/);
    expect(customFn).toHaveBeenCalledTimes(1);
    screen.debug();
  });
});
