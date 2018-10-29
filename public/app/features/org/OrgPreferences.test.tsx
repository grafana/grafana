import React from 'react';
import { shallow } from 'enzyme';
import { OrgPreferences, Props } from './OrgPreferences';

const setup = () => {
  const props: Props = {
    preferences: {
      homeDashboardId: 1,
      timezone: 'UTC',
      theme: 'Default',
    },
    starredDashboards: [{ id: 1, title: 'Standard dashboard', url: '', uri: '', uid: '', type: '', tags: [] }],
    setOrganizationTimezone: jest.fn(),
    setOrganizationTheme: jest.fn(),
    setOrganizationHomeDashboard: jest.fn(),
    updateOrganizationPreferences: jest.fn(),
  };

  return shallow(<OrgPreferences {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });
});
