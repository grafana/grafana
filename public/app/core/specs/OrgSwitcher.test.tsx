import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';

import { OrgSwitcher } from '../components/OrgSwitcher';
import { api } from '../../features/profile/api';
import userEvent from '@testing-library/user-event';
import { OrgRole } from '../../types';

jest.mock('@grafana/runtime', () => ({
  config: {
    appSubUrl: '/subUrl',
  },
}));

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    user: { orgId: 1 },
  },
}));

describe('OrgSwitcher', () => {
  const { location } = window;
  let setUserOrgSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    const orgs = [
      { orgId: 1, name: 'Main Org.', role: OrgRole.Admin },
      { orgId: 2, name: 'Org 2', role: OrgRole.Admin },
    ];
    const loadOrgsSpy = jest.spyOn(api, 'loadOrgs').mockResolvedValue(orgs);
    setUserOrgSpy = jest.spyOn(api, 'setUserOrg').mockResolvedValue(undefined);

    // @ts-ignore
    delete window.location;
    window.location = {} as Location;

    render(<OrgSwitcher onDismiss={() => {}} />);
    await waitFor(() => expect(loadOrgsSpy).toHaveBeenCalledTimes(1));
  });

  afterEach(() => {
    window.location = location;
  });

  describe('when switching org', () => {
    it('should render correct rows', async () => {
      expect(screen.getAllByRole('row')).toHaveLength(3); // header + 2 orgs
      expect(screen.getByRole('row', { name: /main org. admin current/i })).toBeInTheDocument();
      expect(screen.getByRole('row', { name: /org 2 admin switch to/i })).toBeInTheDocument();
    });

    it('should switch orgId in call to backend', async () => {
      const row = screen.getByRole('row', { name: /org 2 admin switch to/i });
      const switchToButton = within(row).getByText(/switch to/i);
      userEvent.click(switchToButton);

      await waitFor(() => expect(setUserOrgSpy).toBeCalledWith({ orgId: 2, name: 'Org 2', role: 'Admin' }));
    });

    it('should redirect to home page', async () => {
      expect(window.location.href).toBeUndefined();

      const row = screen.getByRole('row', { name: /org 2 admin switch to/i });
      const switchToButton = within(row).getByText(/switch to/i);
      userEvent.click(switchToButton);

      await waitFor(() => expect(window.location.href).toEqual('/subUrl/?orgId=2'));
    });
  });
});
