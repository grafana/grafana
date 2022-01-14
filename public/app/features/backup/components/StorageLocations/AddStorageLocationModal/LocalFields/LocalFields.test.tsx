import { TextInputField } from '@percona/platform-core';
import { shallow } from 'enzyme';
import React from 'react';

import { LocalFields } from './LocalFields';

describe('LocalFields', () => {
  it('should pass initial values', () => {
    const wrapper = shallow(<LocalFields name="server" path="/foo" />);

    expect(wrapper.find(TextInputField).prop('initialValue')).toBe('/foo');
  });
});
