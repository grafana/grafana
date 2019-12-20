import React from 'react';
import { shallow } from 'enzyme';

import { UnThemedLogLabels as LogLabels } from './LogLabels';
import { getTheme } from '../../themes';

describe('<LogLabels />', () => {
  it('renders notice when no labels are found', () => {
    const wrapper = shallow(<LogLabels labels={{}} theme={getTheme()} />);
    expect(wrapper.text()).toContain('no unique labels');
  });
  it('renders labels', () => {
    const wrapper = shallow(<LogLabels labels={{ foo: 'bar', baz: '42' }} theme={getTheme()} />);
    expect(wrapper.text()).toContain('bar');
    expect(wrapper.text()).toContain('42');
  });
  it('exlcudes labels with certain names or labels starting with underscore', () => {
    const wrapper = shallow(<LogLabels labels={{ foo: 'bar', level: '42', _private: '13' }} theme={getTheme()} />);
    expect(wrapper.text()).toContain('bar');
    expect(wrapper.text()).not.toContain('42');
    expect(wrapper.text()).not.toContain('13');
  });
});
