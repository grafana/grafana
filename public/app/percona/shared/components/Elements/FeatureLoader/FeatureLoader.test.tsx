import React from 'React';
import { mount, ReactWrapper } from 'enzyme';
import { FeatureLoader } from './FeatureLoader';
import { act } from 'react-dom/test-utils';
import { SettingsService } from 'app/percona/settings/Settings.service';
import { EmptyBlock } from '../EmptyBlock';

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
    let wrapper: ReactWrapper;
    const Dummy = () => <></>;
    await act(async () => {
      wrapper = mount(
        <FeatureLoader featureName="IA" featureFlag="alertingEnabled">
          <Dummy />
        </FeatureLoader>
      );
    });
    expect(wrapper.find(Dummy).exists()).toBeFalsy();
    expect(wrapper.find(EmptyBlock).exists()).toBeTruthy();
  });

  it('should show children after loading settings', async () => {
    let wrapper: ReactWrapper;
    const Dummy = () => <></>;
    await act(async () => {
      wrapper = mount(
        <FeatureLoader featureName="IA" featureFlag="alertingEnabled">
          <Dummy />
        </FeatureLoader>
      );
    });
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

    let wrapper: ReactWrapper;
    await act(async () => {
      wrapper = mount(<FeatureLoader featureName="IA" featureFlag="alertingEnabled" onError={spy} />);
    });
    wrapper.update();
    expect(spy).toHaveBeenCalledWith(errorObj);
  });
});
