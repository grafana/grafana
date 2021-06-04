import React from 'react';
import { LoaderButton, dataQa, logger } from '@percona/platform-core';
import { CheckService } from 'app/percona/check/Check.service';
import { getMount } from 'app/percona/shared/helpers/testUtils';
import { Table } from 'app/percona/check/components';
import { FailedChecksTab } from './FailedChecksTab';

jest.mock('@percona/platform-core', () => {
  const originalModule = jest.requireActual('@percona/platform-core');
  return {
    ...originalModule,
    logger: {
      error: jest.fn(),
    },
  };
});

describe('FailedChecksTab::', () => {
  let getAlertsSpy = jest.spyOn(CheckService, 'getActiveAlerts').mockImplementation(() => Promise.resolve([]));

  afterEach(() => getAlertsSpy.mockClear());

  it('should fetch active alerts at startup', async () => {
    const wrapper = await getMount(<FailedChecksTab hasNoAccess={false} />);

    wrapper.update();
    expect(CheckService.getActiveAlerts).toHaveBeenCalledTimes(1);
  });

  it('should render a spinner at startup, while loading', async () => {
    const wrapper = await getMount(<FailedChecksTab hasNoAccess={false} />);

    expect(wrapper.find(dataQa('db-checks-failed-checks-spinner'))).toHaveLength(1);
    wrapper.update();
    expect(wrapper.find(dataQa('db-checks-failed-checks-spinner'))).toHaveLength(0);
  });

  it('should log an error if the fetch alerts API call fails', async () => {
    getAlertsSpy.mockImplementationOnce(() => {
      throw Error('test');
    });
    const loggerSpy = spyOn(logger, 'error');

    const wrapper = await getMount(<FailedChecksTab hasNoAccess={false} />);
    wrapper.update();

    expect(loggerSpy).toBeCalledTimes(1);
  });

  it('should log an error if the run checks API call fails', async () => {
    getAlertsSpy.mockImplementationOnce(() => {
      throw Error('test');
    });
    const loggerSpy = spyOn(logger, 'error');
    const wrapper = await getMount(<FailedChecksTab hasNoAccess={false} />);
    wrapper.update();
    const runChecksButton = wrapper.find(LoaderButton);

    runChecksButton.simulate('click');

    expect(loggerSpy).toBeCalledTimes(1);
  });

  it('should call the API to run checks when the "run checks" button gets clicked', async () => {
    const runChecksSpy = jest.spyOn(CheckService, 'runDbChecks');
    const wrapper = await getMount(<FailedChecksTab hasNoAccess={false} />);
    wrapper.update();
    const runChecksButton = wrapper.find(LoaderButton);

    expect(runChecksSpy).toBeCalledTimes(0);
    runChecksButton.simulate('click');
    expect(runChecksSpy).toBeCalledTimes(1);

    runChecksSpy.mockClear();
  });

  it('should render a table after having fetched the alerts', async () => {
    const wrapper = await getMount(<FailedChecksTab hasNoAccess={false} />);
    expect(wrapper.find(Table)).toHaveLength(0);
    wrapper.update();

    expect(wrapper.find(Table)).toHaveLength(1);
  });
});
