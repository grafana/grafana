import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { NamedColorsPalette } from './NamedColorsPalette';
import { createTheme, getColorDefinitionByName } from '@grafana/data';
import { ColorSwatch } from './ColorSwatch';
import { ThemeContext } from '../../themes';

describe('NamedColorsPalette', () => {
  const BasicGreen = getColorDefinitionByName('green');

  describe('theme support for named colors', () => {
    let wrapper: ReactWrapper, selectedSwatch;

    afterEach(() => {
      wrapper.unmount();
    });

    it('should render provided color variant specific for theme', () => {
      wrapper = mount(<NamedColorsPalette color={BasicGreen.name} onChange={() => {}} />);
      selectedSwatch = wrapper.find(ColorSwatch).findWhere((node) => node.key() === BasicGreen.name);
      expect(selectedSwatch.prop('color')).toBe(BasicGreen.variants.dark);

      wrapper.unmount();

      const withLightTheme = (
        <ThemeContext.Provider value={createTheme({ colors: { mode: 'light' } })}>
          <NamedColorsPalette color={BasicGreen.name} onChange={() => {}} />
        </ThemeContext.Provider>
      );

      wrapper = mount(withLightTheme);
      selectedSwatch = wrapper.find(ColorSwatch).findWhere((node) => node.key() === BasicGreen.name);
      expect(selectedSwatch.prop('color')).toBe(BasicGreen.variants.light);
    });
  });
});
