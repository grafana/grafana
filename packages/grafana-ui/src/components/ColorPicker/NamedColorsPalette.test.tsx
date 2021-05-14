import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { NamedColorsPalette } from './NamedColorsPalette';
import { createTheme } from '@grafana/data';
import { ColorSwatch } from './ColorSwatch';

describe('NamedColorsPalette', () => {
  const theme = createTheme();
  const greenHue = theme.visualization.hues.find((x) => x.name === 'green')!;
  const selectedShade = greenHue.shades[2];

  describe('theme support for named colors', () => {
    let wrapper: ReactWrapper, selectedSwatch;

    afterEach(() => {
      wrapper.unmount();
    });

    it('should render provided color variant specific for theme', () => {
      wrapper = mount(<NamedColorsPalette color={selectedShade.name} onChange={() => {}} />);
      selectedSwatch = wrapper.find(ColorSwatch).findWhere((node) => node.key() === selectedShade.name);
      expect(selectedSwatch.prop('color')).toBe(selectedShade.color);
    });
  });
});
