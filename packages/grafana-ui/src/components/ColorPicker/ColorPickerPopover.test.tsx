import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { ColorPickerPopover } from './ColorPickerPopover';
import { ColorSwatch } from './ColorSwatch';
import { createTheme } from '@grafana/data';

describe('ColorPickerPopover', () => {
  const theme = createTheme();

  describe('rendering', () => {
    it('should render provided color as selected if color provided by name', () => {
      const wrapper = mount(<ColorPickerPopover color={'green'} onChange={() => {}} />);
      const selectedSwatch = wrapper.find(ColorSwatch).findWhere((node) => node.key() === 'green');
      const notSelectedSwatches = wrapper.find(ColorSwatch).filterWhere((node) => node.prop('isSelected') === false);

      expect(selectedSwatch.length).toBe(1);
      expect(notSelectedSwatches.length).toBe(31);
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
      wrapper = mount(<ColorPickerPopover color={'green'} onChange={onChangeSpy} />);

      const basicBlueSwatch = wrapper.find(ColorSwatch).findWhere((node) => node.key() === 'green');
      basicBlueSwatch.simulate('click');

      expect(onChangeSpy).toBeCalledTimes(1);
      expect(onChangeSpy).toBeCalledWith(theme.visualization.getColorByName('green'));
    });

    it('should pass color name to onChange prop when named colors enabled', () => {
      wrapper = mount(<ColorPickerPopover enableNamedColors color={'green'} onChange={onChangeSpy} />);

      const basicBlueSwatch = wrapper.find(ColorSwatch).findWhere((node) => node.key() === 'green');
      basicBlueSwatch.simulate('click');

      expect(onChangeSpy).toBeCalledTimes(1);
      expect(onChangeSpy).toBeCalledWith('green');
    });
  });
});
