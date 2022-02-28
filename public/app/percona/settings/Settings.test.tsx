import React from 'react';
import { useSelector, Provider } from 'react-redux';
import { Tab } from '@grafana/ui';
import { configureStore } from 'app/store/configureStore';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { stub as settingsStub } from './__mocks__/Settings.service';
import { SettingsService } from './Settings.service';
import { SettingsPanel } from './Settings';
import { getMount } from '../shared/helpers/testUtils';

const fakeLocationUpdate = jest.fn();

jest.mock('./Settings.service');
jest.mock('app/percona/shared/components/hooks/parameters.hook');
jest.mock('react-redux', () => {
  const original = jest.requireActual('react-redux');
  return {
    ...original,
    useSelector: jest.fn(),
  };
});

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  return {
    ...original,
    getLocationSrv: jest.fn().mockImplementation(() => ({ update: fakeLocationUpdate })),
  };
});

describe('SettingsPanel::', () => {
  beforeEach(() => {
    console.error = jest.fn();
    (useSelector as jest.Mock).mockImplementation((callback) => {
      return callback({ perconaUser: { isAuthorized: true }, perconaSettings: { isLoading: false } });
    });
  });

  it('Renders correctly without rendering hidden tab', async () => {
    jest
      .spyOn(SettingsService, 'getSettings')
      .mockImplementationOnce(() => Promise.resolve({ ...settingsStub, alertingEnabled: false }));
    const root = await getMount(
      <Provider store={configureStore()}>
        <SettingsPanel {...getRouteComponentProps({ match: { params: { tab: '' } } as any })} />
      </Provider>
    );
    root.update();

    const tabs = root.find(Tab);
    expect(tabs).toHaveLength(5);
    expect(root.childAt(0).children().length).toBe(1);
  });
});
