import React from 'react';
import { mount } from 'enzyme';
import { Form } from 'react-final-form';
import { dataQa } from '@percona/platform-core';
import { SlackFields } from './SlackFields';

describe('SlackFields', () => {
  it('should render correct fields', () => {
    const wrapper = mount(<Form onSubmit={jest.fn()} render={() => <SlackFields />} />);

    expect(wrapper.find(dataQa('channel-text-input')).length).toBe(1);
  });
});
