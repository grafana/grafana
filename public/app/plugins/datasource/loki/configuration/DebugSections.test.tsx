import React from 'react';
import { DebugSection } from './DebugSection';
import { mount } from 'enzyme';

describe('DebugSection', () => {
  it('does not render any field if no debug text', () => {
    const wrapper = mount(<DebugSection derivedFields={[]} />);
    expect(wrapper.find('DebugFieldItem').length).toBe(0);
  });

  it('does not render any field if no derived fields', () => {
    const wrapper = mount(<DebugSection derivedFields={[]} />);
    const textarea = wrapper.find('textarea');
    (textarea.getDOMNode() as HTMLTextAreaElement).value = 'traceId=1234';
    textarea.simulate('change');
    expect(wrapper.find('DebugFieldItem').length).toBe(0);
  });

  it('renders derived fields', () => {
    const derivedFields = [
      {
        matcherRegex: 'traceId=(w+)',
        name: 'traceIdLink',
        url: 'localhost/trace/${__value.text}',
      },
      {
        matcherRegex: 'traceId=(w+)',
        name: 'traceId',
      },
      {
        matcherRegex: 'traceId=(',
        name: 'error',
      },
    ];

    const wrapper = mount(<DebugSection derivedFields={derivedFields} />);
    const textarea = wrapper.find('textarea');
    (textarea.getDOMNode() as HTMLTextAreaElement).value = 'traceId=1234';
    textarea.simulate('change');

    expect(wrapper.find('DebugFieldItem').length).toBe(3);
  });
});
