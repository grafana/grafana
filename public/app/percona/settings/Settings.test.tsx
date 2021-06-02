import React from 'react';
import { act } from 'react-dom/test-utils';
import { useSelector } from 'react-redux';
import { Tab } from '@grafana/ui';
import { mount, ReactWrapper } from 'enzyme';
import { stub as settingsStub } from './__mocks__/Settings.service';
import { SettingsService } from './Settings.service';
import { SettingsPanel } from './Settings';

const fakeLocationUpdate = jest.fn();

jest.mock('./Settings.service');
jest.mock('app/percona/shared/components/hooks/parameters.hook');
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getLocationSrv: jest.fn().mockImplementation(() => ({ update: fakeLocationUpdate })),
}));

describe('SettingsPanel::', () => {
  beforeEach(() => {
    console.error = jest.fn();
    (useSelector as jest.Mock).mockImplementation(callback => {
      return callback({ location: { routeParams: { tab: 'alerts' }, path: '/integrated-alerting/alerts' } });
    });
  });
  it('Renders correctly without rendering hidden tab', async () => {
    jest
      .spyOn(SettingsService, 'getSettings')
      .mockImplementationOnce(() => Promise.resolve({ ...settingsStub, alertingEnabled: false }));
    let root: ReactWrapper;

    await act(async () => {
      root = mount(<SettingsPanel />);
    });
    root.update();

    const tabs = root.find(Tab);
    expect(tabs).toHaveLength(5);
    expect(root.childAt(0).children().length).toBe(1);
  });
});
