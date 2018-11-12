import React from 'react';
import { shallow } from 'enzyme';
import { TeamPreferences, Props } from './TeamPreferences';

const setup = () => {
  const props: Props = {
    preferences: {
      homeDashboardId: 1,
      timezone: 'UTC',
      theme: 'Default',
    },
    starredDashboards: [{ id: 1, title: 'Standard dashboard', url: '', uri: '', uid: '', type: '', tags: [] }],
    setTeamTimezone: jest.fn(),
    setTeamTheme: jest.fn(),
    setTeamHomeDashboard: jest.fn(),
    updateTeamPreferences: jest.fn(),
  };

  return shallow(<TeamPreferences {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });
});
