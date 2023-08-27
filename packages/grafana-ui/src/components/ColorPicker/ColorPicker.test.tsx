import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import renderer from 'react-test-renderer';

import { ColorPicker } from './ColorPicker';
import { ColorSwatch } from './ColorSwatch';

describe('ColorPicker', () => {
  it('renders ColorPickerTrigger component by default', () => {
    expect(
      renderer.create(<ColorPicker color="#EAB839" onChange={() => {}} />).root.findByType(ColorSwatch)
    ).toBeTruthy();
  });

  it('should not have buttons with default submit type', async () => {
    render(<ColorPicker color="blue" enableNamedColors onChange={() => {}} />);
    const mainButton = screen.getAllByRole('button');
    expect(mainButton.length).toBe(1);
    mainButton.forEach((button) => expect(button).toHaveAttribute('type', 'button'));
    await userEvent.click(mainButton[0]);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(35);
    buttons.forEach((button) => expect(button).toHaveAttribute('type', 'button'));
  });

  it('renders custom trigger when supplied', () => {
    const div = renderer
      .create(
        <ColorPicker color="#EAB839" onChange={() => {}}>
          {() => <div>Custom trigger</div>}
        </ColorPicker>
      )
      .root.findByType('div');
    expect(div.children[0]).toBe('Custom trigger');
  });
});
