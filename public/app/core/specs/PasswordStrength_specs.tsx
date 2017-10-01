import React from 'react';
import {describe, it, expect} from 'test/lib/common';
import {shallow} from 'enzyme';

import {PasswordStrength} from '../components/PasswordStrength';

describe('PasswordStrength', () => {

  it('should have class bad if length below 4', () => {
    const wrapper = shallow(<PasswordStrength password="asd" />);
    expect(wrapper.find(".password-strength-bad")).to.have.length(1);
  });

  it('should have class ok if length below 8', () => {
    const wrapper = shallow(<PasswordStrength password="asdasd" />);
    expect(wrapper.find(".password-strength-ok")).to.have.length(1);
  });

  it('should have class good if length above 8', () => {
    const wrapper = shallow(<PasswordStrength password="asdaasdda" />);
    expect(wrapper.find(".password-strength-good")).to.have.length(1);
  });

});

