import React from 'react';
import { act } from 'react-dom/test-utils';
import { mount } from 'enzyme';
import { SettingsPanel } from './Settings';
import { useSelector } from 'react-redux';

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
    let root;

    await act(async () => {
      root = mount(<SettingsPanel />);
    });

    const tabs = root.find('[data-qa="settings-tabs"]');

    expect(tabs.children().length).toBe(5);
    expect(root.childAt(0).children().length).toBe(1);
  });
});
