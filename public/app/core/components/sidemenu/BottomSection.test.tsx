import React from 'react';
import { shallow } from 'enzyme';
import BottomSection from './BottomSection';

jest.mock('../../config', () => ({
  bootData: {
    navTree: [
      {
        id: 'profile',
        hideFromMenu: true,
      },
      {
        hideFromMenu: true,
      },
      {
        hideFromMenu: false,
      },
      {
        hideFromMenu: true,
      },
    ],
  },
  user: {
    orgCount: 5,
    orgName: 'Grafana',
  },
}));

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    sidemenu: true,
    isSignedIn: false,
    isGrafanaAdmin: false,
    hasEditPermissionFolders: false,
  },
}));

describe('Render', () => {
  it('should render component', () => {
    const wrapper = shallow(<BottomSection />);

    expect(wrapper).toMatchSnapshot();
  });
});
