import React from 'react';
import { shallow } from 'enzyme';
import BottomNavLinks from './BottomNavLinks';
import appEvents from '../../app_events';
import { CoreEvents } from 'app/types';

jest.mock('../../app_events', () => ({
  emit: jest.fn(),
}));

const setup = (propOverrides?: object) => {
  const props = Object.assign(
    {
      link: {
        text: 'Hello',
      },
      user: {
        id: 1,
        isGrafanaAdmin: false,
        isSignedIn: false,
        orgCount: 2,
        orgRole: '',
        orgId: 1,
        login: 'hello',
        orgName: 'Grafana',
        timezone: 'UTC',
        helpFlags1: 1,
        lightTheme: false,
        hasEditPermissionInFolders: false,
      },
    },
    propOverrides
  );
  return shallow(<BottomNavLinks {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render organization switcher', () => {
    const wrapper = setup({
      link: {
        showOrgSwitcher: true,
      },
    });

    wrapper.find('.sidemenu-org-switcher a').simulate('click');
    expect(wrapper).toMatchSnapshot();
  });

  it('should render subtitle', () => {
    const wrapper = setup({
      link: {
        subTitle: 'subtitle',
      },
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('should render children', () => {
    const wrapper = setup({
      link: {
        children: [
          {
            id: '1',
          },
          {
            id: '2',
          },
          {
            id: '3',
          },
          {
            id: '4',
            hideFromMenu: true,
          },
        ],
      },
    });

    expect(wrapper).toMatchSnapshot();
  });
});

describe('Functions', () => {
  describe('item clicked', () => {
    const wrapper = setup();
    it('should emit show modal event if url matches shortcut', () => {
      const instance = wrapper.instance() as BottomNavLinks;
      instance.onOpenShortcuts();

      expect(appEvents.emit).toHaveBeenCalledWith(CoreEvents.showModal, { templateHtml: '<help-modal></help-modal>' });
    });
  });
});
