import React from 'react';
import { mount } from 'enzyme';
import { Form } from 'react-final-form';
import { dataTestId } from '@percona/platform-core';
import { EmailFields } from './EmailFields';

xdescribe('EmailFields', () => {
  it('should render correct fields', () => {
    const wrapper = mount(<Form onSubmit={jest.fn()} render={() => <EmailFields />} />);

    expect(wrapper.find(dataTestId('emails-textarea-input')).length).toBe(1);
  });
});
