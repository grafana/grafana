import React from 'react';
import { shallow } from 'enzyme';
import AlertRuleItem, { Props } from './AlertRuleItem';

const setup = (propOverrides?: object) => {
  const props: Props = {
    rule: {
      id: 1,
      dashboardId: 1,
      panelId: 1,
      name: 'Some rule',
      state: 'Open',
      stateText: 'state text',
      stateIcon: 'icon',
      stateClass: 'state class',
      stateAge: 'age',
      url: 'https://something.something.darkside',
    },
    search: '',
  };
  Object.assign(props, propOverrides);

  return shallow(<AlertRuleItem {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });
});
