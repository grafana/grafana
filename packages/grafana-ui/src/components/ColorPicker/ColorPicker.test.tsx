import React from 'react';
import renderer from 'react-test-renderer';
import { ColorPicker } from './ColorPicker';
import { ColorPickerTrigger } from './ColorPickerTrigger';

describe('ColorPicker', () => {
  it('renders ColorPickerTrigger component by default', () => {
    expect(
      renderer.create(<ColorPicker color="#EAB839" onChange={() => {}} />).root.findByType(ColorPickerTrigger)
    ).toBeTruthy();
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
