import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { Input } from '../Input/Input';

import { AutoSaveField, Props } from './AutoSaveField';

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    label: 'Test',
    onFinishChange: jest.fn(),
    children: <Input label="input test" name="input-test" />,
  };

  Object.assign(props, propOverrides);
};

/* 
Cases to cover:
1.- General:
  a) It renders
  b) It has a children
  c) It has a onFinishChange function
  d) If success, the InlineToast renders on the right
  e) If succes but not enough space, the InlineToas renders on the bottom
2.- Per child:
  a) It renders
  b) When it is succesful, it show the InlineToas saying Saved!
  c) When there was an error, show the error message
  d) When there was an error and the child has an invalid prop, show the red border
*/

describe('AutoSaveField ', () => {
  it('renders with an Input as a children', () => {
    setup();
    expect(screen.getByLabelText(/AutoSaveField label test/)).toBeInTheDocument();
    screen.debug();
  });
  it('triggers the function on change', () => {
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
    fireEvent.change(screen.getByLabelText('AutoSaveField label test'), {
      target: { value: 'test value' },
    });

    expect(customFn).toHaveBeenCalledTimes(1);
  });
});
