import { dataQa } from '@percona/platform-core';
import { mount } from 'enzyme';
import React from 'react';
import { Form } from 'react-final-form';

import { EmailFields } from './EmailFields';

xdescribe('EmailFields', () => {
  it('should render correct fields', () => {
    const wrapper = mount(<Form onSubmit={jest.fn()} render={() => <EmailFields />} />);

    expect(wrapper.find(dataQa('emails-textarea-input')).length).toBe(1);
  });
});
