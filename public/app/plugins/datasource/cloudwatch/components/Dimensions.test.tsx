import React from 'react';
import { mount, shallow } from 'enzyme';
import { Dimensions } from './';
import { SelectableStrings } from '../types';

describe('Dimensions', () => {
  it('renders', () => {
    mount(
      <Dimensions
        dimensions={{}}
        onChange={dimensions => console.log(dimensions)}
        loadKeys={() => Promise.resolve<SelectableStrings>([])}
        loadValues={() => Promise.resolve<SelectableStrings>([])}
      />
    );
  });

  describe('and no dimension were passed to the component', () => {
    it('initially displays just an add button', () => {
      const wrapper = shallow(
        <Dimensions
          dimensions={{}}
          onChange={() => {}}
          loadKeys={() => Promise.resolve<SelectableStrings>([])}
          loadValues={() => Promise.resolve<SelectableStrings>([])}
        />
      );

      expect(wrapper.html()).toEqual(expect.stringContaining(`gf-form`));
    });
  });

  describe('and one dimension key along with a value were passed to the component', () => {
    it('initially displays the dimension key, value and an add button', () => {
      const wrapper = shallow(
        <Dimensions
          dimensions={{ somekey: 'somevalue' }}
          onChange={() => {}}
          loadKeys={() => Promise.resolve<SelectableStrings>([])}
          loadValues={() => Promise.resolve<SelectableStrings>([])}
        />
      );
      expect(wrapper.html()).toEqual(expect.stringContaining(`gf-form`));
    });
  });
});
