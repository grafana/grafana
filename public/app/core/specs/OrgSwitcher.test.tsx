import React from 'react';
import { backendSrv } from 'app/core/services/backend_srv';
import { OrgSwitcher } from '../components/OrgSwitcher';
import { shallow } from 'enzyme';
import { OrgRole } from '@grafana/data';

jest.spyOn(backendSrv, 'get').mockImplementation(() => Promise.resolve([]));
const postMock = jest.spyOn(backendSrv, 'post').mockImplementation(jest.fn());

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    user: { orgId: 1 },
  },
}));

jest.mock('app/core/config', () => {
  return {
    appSubUrl: '/subUrl',
  };
});

let wrapper;
let orgSwitcher: OrgSwitcher;

describe('OrgSwitcher', () => {
  describe('when switching org', () => {
    beforeEach(async () => {
      wrapper = shallow(<OrgSwitcher onDismiss={() => {}} />);
      orgSwitcher = wrapper.instance() as OrgSwitcher;
      orgSwitcher.setWindowLocation = jest.fn();
      wrapper.update();
      await orgSwitcher.setCurrentOrg({ name: 'mock org', orgId: 2, role: OrgRole.Viewer });
    });

    it('should switch orgId in call to backend', () => {
      expect(postMock).toBeCalledWith('/api/user/using/2');
    });

    it('should switch orgId in url and redirect to home page', () => {
      expect(orgSwitcher.setWindowLocation).toBeCalledWith('/subUrl/?orgId=2');
    });
  });
});
