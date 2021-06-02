import React from 'react';
import { mount } from 'enzyme';
import { Form } from 'react-final-form';
import { dataQa } from '@percona/platform-core';
import { EmailFields } from './EmailFields';

describe('EmailFields', () => {
  it('should render correct fields', () => {
    const wrapper = mount(<Form onSubmit={jest.fn()} render={() => <EmailFields />} />);

    expect(wrapper.find(dataQa('emails-textarea-input')).length).toBe(1);
  });
});
