import React from 'react';
import { shallow } from 'enzyme';
import { SideMenu } from './SideMenu';

jest.mock('../../app_events', () => ({
  emit: jest.fn(),
}));

jest.mock('app/store/store', () => ({
  store: {
    getState: jest.fn().mockReturnValue({
      location: {
        lastUpdated: 0,
      },
    }),
  },
}));

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    sidemenu: true,
    user: {},
    isSignedIn: false,
    isGrafanaAdmin: false,
    isEditor: false,
    hasEditPermissionFolders: false,
  },
}));

const setup = () => {
  return shallow(<SideMenu />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();
    expect(wrapper).toMatchSnapshot();
  });
});
