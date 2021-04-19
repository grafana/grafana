import React from 'react';
import { act } from 'react-dom/test-utils';
import { mount, shallow } from 'enzyme';
import { activeCheckStub } from 'app/percona/check/__mocks__/stubs';
import { SilenceAlertButton } from 'app/percona/check/components';
import { AlertsReloadContext } from 'app/percona/check/Check.context';
import { CheckService } from 'app/percona/check/Check.service';
import { makeSilencePayload } from './SilenceAlertButton.utils';
import { LoaderButton, logger } from '@percona/platform-core';

jest.mock('../../Check.service');
jest.mock('app/percona/shared/components/hooks/cancelToken.hook');
jest.mock('./SilenceAlertButton.utils', () => ({
  makeSilencePayload: jest.fn(() => 'testPayload'),
}));
jest.mock('@percona/platform-core', () => {
  const originalModule = jest.requireActual('@percona/platform-core');
  return {
    ...originalModule,
    logger: {
      error: jest.fn(),
    },
  };
});

const mockedMakeSilencePayload = makeSilencePayload as jest.Mock;

describe('SilenceAlertButton::', () => {
  afterEach(() => {
    mockedMakeSilencePayload.mockClear();
  });

  it('should contain a LoaderButton', () => {
    const { labels } = activeCheckStub[0].details[0];

    const root = shallow(<SilenceAlertButton labels={labels} />);

    expect(root.find(LoaderButton).length).toEqual(1);
  });

  it('should call functions to buind the payload and to call the API to silence an alert on click', async () => {
    const { labels } = activeCheckStub[0].details[0];

    window.grafanaBootData = {
      user: {
        name: 'test_user',
      },
    };

    const fakeFetchAlerts = jest.fn();

    const spy = jest.spyOn(CheckService, 'silenceAlert');

    const root = mount(
      <AlertsReloadContext.Provider value={{ fetchAlerts: fakeFetchAlerts }}>
        <SilenceAlertButton labels={labels} />
      </AlertsReloadContext.Provider>
    );

    const wrapper = root.find(SilenceAlertButton);

    expect(mockedMakeSilencePayload).toBeCalledTimes(0);
    expect(spy).toBeCalledTimes(0);
    expect(fakeFetchAlerts).toBeCalledTimes(0);

    await act(async () => {
      wrapper.find(LoaderButton).simulate('click');
    });
    wrapper.update();

    expect(mockedMakeSilencePayload).toBeCalledTimes(1);
    expect(spy).toBeCalledTimes(1);
    expect(spy).toBeCalledWith('testPayload');
    expect(fakeFetchAlerts).toBeCalledTimes(1);

    spy.mockClear();

    root.unmount();
  });

  it('should call functions to buind the payload and to call the API to silence an alert on click', async () => {
    const { labels } = activeCheckStub[0].details[0];

    window.grafanaBootData = {
      user: {
        name: 'test_user',
      },
    };

    const spy = jest.spyOn(CheckService, 'silenceAlert');

    spy.mockImplementation(() => {
      throw Error('Test error');
    });

    const root = shallow(<SilenceAlertButton labels={labels} />);

    await act(async () => {
      root.simulate('click');
    });

    expect(logger.error).toBeCalledTimes(1);
    expect(logger.error).toBeCalledWith(Error('Test error'));

    spy.mockClear();

    root.unmount();
  });
});
