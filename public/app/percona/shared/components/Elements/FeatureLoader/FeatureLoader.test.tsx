import React from 'react';
import { dataTestId } from '@percona/platform-core';
import { useSelector } from 'react-redux';
import { FeatureLoader } from './FeatureLoader';
import { Messages } from './FeatureLoader.messages';
import { EmptyBlock } from '../EmptyBlock';
import { getMount } from 'app/percona/shared/helpers/testUtils';

jest.mock('app/percona/settings/Settings.service');
jest.mock('@percona/platform-core', () => {
  const originalModule = jest.requireActual('@percona/platform-core');
  return {
    ...originalModule,
    logger: {
      error: jest.fn(),
    },
  };
});
jest.mock('react-redux', () => {
  const original = jest.requireActual('react-redux');
  return {
    ...original,
    useSelector: jest.fn(),
  };
});

describe('FeatureLoader', () => {
  beforeEach(() => {
    (useSelector as jest.Mock).mockImplementation((callback) => {
      return callback({
        perconaUser: { isAuthorized: true },
        perconaSettings: { isLoading: false, alertingEnabled: true },
      });
    });
  });

  afterEach(() => {
    (useSelector as jest.Mock).mockClear();
  });

  it('should not have children initially', async () => {
    (useSelector as jest.Mock).mockImplementation((callback) => {
      return callback({
        perconaUser: { isAuthorized: true },
        perconaSettings: { isLoading: false, alertingEnabled: false },
      });
    });

    const Dummy = () => <></>;
    const wrapper = await getMount(
      <FeatureLoader featureName="IA" featureSelector={(state) => !!state.perconaSettings.alertingEnabled}>
        <Dummy />
      </FeatureLoader>
    );
    expect(wrapper.find(Dummy).exists()).toBeFalsy();
    expect(wrapper.find(EmptyBlock).exists()).toBeTruthy();
  });

  it('should show children after loading settings', async () => {
    const Dummy = () => <></>;
    const wrapper = await getMount(
      <FeatureLoader featureName="IA" featureSelector={(state) => !!state.perconaSettings.alertingEnabled}>
        <Dummy />
      </FeatureLoader>
    );
    wrapper.update();
    expect(wrapper.find(Dummy).exists()).toBeTruthy();
    expect(wrapper.find(EmptyBlock).exists()).toBeFalsy();
  });

  it('should show insufficient access permissions message', async () => {
    (useSelector as jest.Mock).mockImplementation((callback) => {
      return callback({
        perconaUser: { isAuthorized: false },
        perconaSettings: { isLoading: false, alertingEnabled: false },
      });
    });

    const wrapper = await getMount(
      <FeatureLoader featureName="IA" featureSelector={(state) => !!state.perconaSettings.alertingEnabled} />
    );
    wrapper.update();

    expect(wrapper.find(dataTestId('unauthorized')).text()).toBe(Messages.unauthorized);
  });
});
