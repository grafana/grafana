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

      expect(wrapper.html()).toEqual(
        `<div class=\"gf-form\"><a class=\"gf-form-label query-part\"><div class=\"css-1cvxpvr\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"currentColor\" class=\"css-cl2p4e\"><path d=\"M12,2A10,10,0,1,0,22,12,10,10,0,0,0,12,2Zm0,18a8,8,0,1,1,8-8A8,8,0,0,1,12,20Zm4-9H13V8a1,1,0,0,0-2,0v3H8a1,1,0,0,0,0,2h3v3a1,1,0,0,0,2,0V13h3a1,1,0,0,0,0-2Z\"></path></svg></div></a></div>`
      );
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
      expect(wrapper.html()).toEqual(
        `<div class=\"gf-form\"><a class=\"gf-form-label query-part\">somekey</a></div><label class=\"gf-form-label query-segment-operator\">=</label><div class=\"gf-form\"><a class=\"gf-form-label query-part\">somevalue</a></div><div class=\"gf-form\"><a class=\"gf-form-label query-part\"><div class=\"css-1cvxpvr\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"currentColor\" class=\"css-cl2p4e\"><path d=\"M12,2A10,10,0,1,0,22,12,10,10,0,0,0,12,2Zm0,18a8,8,0,1,1,8-8A8,8,0,0,1,12,20Zm4-9H13V8a1,1,0,0,0-2,0v3H8a1,1,0,0,0,0,2h3v3a1,1,0,0,0,2,0V13h3a1,1,0,0,0,0-2Z\"></path></svg></div></a></div>`
      );
    });
  });
});
