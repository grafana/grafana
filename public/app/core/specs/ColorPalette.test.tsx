import React from 'react';
import renderer from 'react-test-renderer';
import { ColorPalette } from '../components/colorpicker/ColorPalette';

describe('CollorPalette', () => {
  it('renders correctly', () => {
    const tree = renderer.create(<ColorPalette color="#EAB839" onColorSelect={jest.fn()} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
