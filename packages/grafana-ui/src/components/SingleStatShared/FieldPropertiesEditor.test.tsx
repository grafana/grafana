import React from 'react';
import { FieldPropertiesEditor } from './FieldPropertiesEditor';
import { FieldConfig } from '@grafana/data';
import { mount } from 'enzyme';

describe('FieldPropertiesEditor', () => {
  describe('when bluring min/max field', () => {
    it("when title was modified it should persist it's value", () => {
      const onChangeHandler = jest.fn();
      const value: FieldConfig = {
        title: 'Title set',
      };
      const container = mount(<FieldPropertiesEditor value={value} onChange={onChangeHandler} showTitle showMinMax />);
      const minInput = container.find('input[aria-label="Field properties editor min input"]');
      const maxInput = container.find('input[aria-label="Field properties editor max input"]');

      // Simulating title update provided from PanelModel options
      container.setProps({ value: { title: 'Title updated' } });

      minInput.simulate('blur');
      maxInput.simulate('blur');

      expect(onChangeHandler).toHaveBeenLastCalledWith({
        title: 'Title updated',
        min: undefined,
        max: undefined,
        decimals: undefined,
      });
    });
  });
});
//
