import React from 'react';
import { shallow } from 'enzyme';
import { SideMenu } from './SideMenu';
import appEvents from '../../app_events';

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

const setup = (propOverrides?: object) => {
  const props = Object.assign(
    {
      loginUrl: '',
      user: {},
      mainLinks: [],
      bottomeLinks: [],
      isSignedIn: false,
    },
    propOverrides
  );

  return shallow(<SideMenu {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });
});

describe('Functions', () => {
  describe('toggle side menu on mobile', () => {
    const wrapper = setup();
    const instance = wrapper.instance() as SideMenu;
    instance.toggleSideMenuSmallBreakpoint();

    it('should emit toggle sidemenu event', () => {
      expect(appEvents.emit).toHaveBeenCalledWith('toggle-sidemenu-mobile');
    });
  });
});
