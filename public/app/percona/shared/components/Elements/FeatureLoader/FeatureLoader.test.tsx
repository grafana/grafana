import React from 'react';
import { dataTestId } from '@percona/platform-core';
import { FeatureLoader } from './FeatureLoader';
import { Messages } from './FeatureLoader.messages';
import { SettingsService } from 'app/percona/settings/Settings.service';
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

describe('FeatureLoader', () => {
  it('should not have children initially', async () => {
    const Dummy = () => <></>;
    const wrapper = await getMount(
      <FeatureLoader featureName="IA" featureFlag="alertingEnabled">
        <Dummy />
      </FeatureLoader>
    );
    expect(wrapper.find(Dummy).exists()).toBeFalsy();
    expect(wrapper.find(EmptyBlock).exists()).toBeTruthy();
  });

  it('should show children after loading settings', async () => {
    const Dummy = () => <></>;
    const wrapper = await getMount(
      <FeatureLoader featureName="IA" featureFlag="alertingEnabled">
        <Dummy />
      </FeatureLoader>
    );
    wrapper.update();
    expect(wrapper.find(Dummy).exists()).toBeTruthy();
    expect(wrapper.find(EmptyBlock).exists()).toBeFalsy();
  });

  it('should call onError', async () => {
    const errorObj = { response: { status: 401 } };
    jest.spyOn(SettingsService, 'getSettings').mockImplementationOnce(() => {
      throw errorObj;
    });
    const spy = jest.fn();

    const wrapper = await getMount(<FeatureLoader featureName="IA" featureFlag="alertingEnabled" onError={spy} />);
    wrapper.update();
    expect(spy).toHaveBeenCalledWith(errorObj);
  });

  it('should show insufficient access permissions message', async () => {
    const errorObj = { response: { status: 401 } };
    jest.spyOn(SettingsService, 'getSettings').mockImplementationOnce(() => {
      throw errorObj;
    });

    const wrapper = await getMount(<FeatureLoader featureName="IA" featureFlag="alertingEnabled" onError={() => {}} />);
    wrapper.update();

    expect(wrapper.find(dataTestId('unauthorized')).text()).toBe(Messages.unauthorized);
  });

  it('should call onSettingsLoaded', async () => {
    const Dummy = () => <></>;
    const onSettingsLoaded = jest.fn();

    await getMount(
      <FeatureLoader featureName="IA" featureFlag="alertingEnabled" onSettingsLoaded={onSettingsLoaded}>
        <Dummy />
      </FeatureLoader>
    );

    expect(onSettingsLoaded).toHaveBeenCalled();
  });
});
