import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { ColorPickerPopover } from './ColorPickerPopover';
import { ColorSwatch } from './NamedColorsGroup';
import flatten from 'lodash/flatten';
import { getTheme } from '../../themes';
import { GrafanaThemeType, getNamedColorPalette, getColorFromHexRgbOrName } from '@grafana/data';

const allColors = flatten(Array.from(getNamedColorPalette().values()));

describe('ColorPickerPopover', () => {
  describe('rendering', () => {
    it('should render provided color as selected if color provided by name', () => {
      const theme = getTheme();
      const wrapper = mount(<ColorPickerPopover color={'green'} onChange={() => {}} theme={theme} />);
      const selectedSwatch = wrapper.find(ColorSwatch).findWhere(node => node.key() === 'green');
      const notSelectedSwatches = wrapper.find(ColorSwatch).filterWhere(node => node.prop('isSelected') === false);

      expect(selectedSwatch.length).toBe(1);
      expect(notSelectedSwatches.length).toBe(allColors.length - 1);
      expect(selectedSwatch.prop('isSelected')).toBe(true);
    });

    it('should render provided color as selected if color provided by hex', () => {
      const theme = getTheme();
      const wrapper = mount(<ColorPickerPopover color={'green'} onChange={() => {}} theme={theme} />);

      const selectedSwatch = wrapper.find(ColorSwatch).findWhere(node => node.key() === 'green');
      const notSelectedSwatches = wrapper.find(ColorSwatch).filterWhere(node => node.prop('isSelected') === false);

      expect(selectedSwatch.length).toBe(1);
      expect(notSelectedSwatches.length).toBe(allColors.length - 1);
      expect(selectedSwatch.prop('isSelected')).toBe(true);
    });
  });

  describe('named colors support', () => {
    const onChangeSpy = jest.fn();
    let wrapper: ReactWrapper;

    afterEach(() => {
      wrapper.unmount();
      onChangeSpy.mockClear();
    });

    it('should pass hex color value to onChange prop by default', () => {
      wrapper = mount(
        <ColorPickerPopover color={'green'} onChange={onChangeSpy} theme={getTheme(GrafanaThemeType.Light)} />
      );

      const basicBlueSwatch = wrapper.find(ColorSwatch).findWhere(node => node.key() === 'green');
      basicBlueSwatch.simulate('click');

      expect(onChangeSpy).toBeCalledTimes(1);
      expect(onChangeSpy).toBeCalledWith(getColorFromHexRgbOrName('green', GrafanaThemeType.Light));
    });

    it('should pass color name to onChange prop when named colors enabled', () => {
      wrapper = mount(
        <ColorPickerPopover
          enableNamedColors
          color={'green'}
          onChange={onChangeSpy}
          theme={getTheme(GrafanaThemeType.Light)}
        />
      );

      const basicBlueSwatch = wrapper.find(ColorSwatch).findWhere(node => node.key() === 'green');
      basicBlueSwatch.simulate('click');

      expect(onChangeSpy).toBeCalledTimes(1);
      expect(onChangeSpy).toBeCalledWith('green');
    });
  });
});
