import { mount } from 'enzyme';
import React from 'react';

import { CompletionItem } from '../../types';

import { TypeaheadInfo } from './TypeaheadInfo';

describe('TypeaheadInfo component', () => {
  it('should show documentation as rendered markdown if passed as a markdown', () => {
    const item: CompletionItem = { label: 'markdown', documentation: '**bold**' };
    const wrapper = mount(<TypeaheadInfo item={item} height={100} />);
    expect(wrapper.find('div>div').html()).toMatch('strong');
  });
});
