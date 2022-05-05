import { shallow } from 'enzyme';
import React from 'react';

import { createTheme } from '@grafana/data';

import { UnThemedLogMessageAnsi as LogMessageAnsi } from './LogMessageAnsi';

describe('<LogMessageAnsi />', () => {
  it('renders string without ANSI codes', () => {
    const wrapper = shallow(<LogMessageAnsi value="Lorem ipsum" theme={createTheme()} />);

    expect(wrapper.find('span').exists()).toBe(false);
    expect(wrapper.text()).toBe('Lorem ipsum');
  });
  it('renders string with ANSI codes', () => {
    const value = 'Lorem \u001B[31mipsum\u001B[0m et dolor';
    const wrapper = shallow(<LogMessageAnsi value={value} theme={createTheme()} />);

    expect(wrapper.find('span')).toHaveLength(1);
    expect(wrapper.find('span').first().prop('style')).toMatchObject(
      expect.objectContaining({
        color: expect.any(String),
      })
    );
    expect(wrapper.find('span').first().text()).toBe('ipsum');
  });
  it('renders string with ANSI codes with correctly converted css classnames', () => {
    const value = 'Lorem \u001B[1;32mIpsum';
    const wrapper = shallow(<LogMessageAnsi value={value} theme={createTheme()} />);

    expect(wrapper.find('span')).toHaveLength(1);
    expect(wrapper.find('span').first().prop('style')).toMatchObject(
      expect.objectContaining({
        fontWeight: expect.any(String),
      })
    );
  });
  it('renders string with ANSI dim code with appropriate themed color', () => {
    const value = 'Lorem \u001B[1;2mIpsum';
    const theme = createTheme();
    const wrapper = shallow(<LogMessageAnsi value={value} theme={theme} />);

    expect(wrapper.find('span')).toHaveLength(1);
    expect(wrapper.find('span').first().prop('style')).toMatchObject(
      expect.objectContaining({
        color: theme.colors.text.secondary,
      })
    );
  });
});
