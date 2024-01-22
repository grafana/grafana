import { render, screen } from '@testing-library/react';
import React from 'react';

import config from 'app/core/config';

import { ServerStats } from './ServerStats';
import { ServerStat } from './state/apis';

const stats: ServerStat = {
  activeAdmins: 1,
  activeEditors: 0,
  activeSessions: 1,
  activeUsers: 1,
  activeViewers: 0,
  activeDevices: 1,
  admins: 1,
  alerts: 5,
  dashboards: 1599,
  datasources: 54,
  editors: 2,
  orgs: 1,
  playlists: 1,
  snapshots: 1,
  stars: 3,
  tags: 42,
  users: 5,
  viewers: 2,
};

jest.mock('./state/apis', () => ({
  getServerStats: async () => stats,
}));
jest.mock('../../core/services/context_srv', () => ({
  contextSrv: {
    hasPermission: () => true,
  },
}));

describe('ServerStats', () => {
  it('Should render page with stats', async () => {
    render(<ServerStats />);
    expect(await screen.findByRole('heading', { name: /instance statistics/i })).toBeInTheDocument();
    expect(screen.getByText('Dashboards (starred)')).toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('Playlists')).toBeInTheDocument();
    expect(screen.getByText('Snapshots')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage dashboards' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage data sources' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage alerts' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage users' })).toBeInTheDocument();
  });

  it('Should render page with anonymous stats', async () => {
    config.featureToggles.displayAnonymousStats = true;
    config.anonymousEnabled = true;
    config.anonymousDeviceLimit = 10;
    render(<ServerStats />);
    expect(await screen.findByRole('heading', { name: /instance statistics/i })).toBeInTheDocument();
    expect(screen.getByText('Active anonymous devices')).toBeInTheDocument();
  });
});
