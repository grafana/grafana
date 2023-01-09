import { render, screen, waitFor } from '@testing-library/react';
// eslint-disable-next-line lodash/import-scope
import lodash from 'lodash';
import React from 'react';

import { config } from '@grafana/runtime';

import { setupMockedDataSource } from '../../__mocks__/CloudWatchDataSource';

import { LogGroupsField } from './LogGroupsField';

const originalFeatureToggleValue = config.featureToggles.cloudWatchCrossAccountQuerying;
const originalDebounce = lodash.debounce;

const defaultProps = {
  datasource: setupMockedDataSource().datasource,
  region: '',
  onChange: jest.fn(),
};
describe('LogGroupSelection', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    lodash.debounce = jest.fn().mockImplementation((fn) => {
      fn.cancel = () => {};
      return fn;
    });
  });
  afterEach(() => {
    config.featureToggles.cloudWatchCrossAccountQuerying = originalFeatureToggleValue;
    lodash.debounce = originalDebounce;
  });

  it('call describeCrossAccountLogGroups to get associated log group arns and then update props if rendered with legacy log group names', async () => {
    config.featureToggles.cloudWatchCrossAccountQuerying = true;
    defaultProps.datasource.api.describeLogGroups = jest
      .fn()
      .mockResolvedValue([{ value: { arn: 'arn', name: 'loggroupname' } }]);
    render(<LogGroupsField {...defaultProps} legacyLogGroupNames={['loggroupname']} />);

    await waitFor(async () => expect(screen.getByText('Select Log Groups')).toBeInTheDocument());
    expect(defaultProps.datasource.api.describeLogGroups).toHaveBeenCalledWith({
      region: defaultProps.region,
      logGroupNamePrefix: 'loggroupname',
    });
    expect(defaultProps.onChange).toHaveBeenCalledWith([{ arn: 'arn', name: 'loggroupname' }]);
  });

  it('should not call describeCrossAccountLogGroups and update props if rendered with log groups', async () => {
    config.featureToggles.cloudWatchCrossAccountQuerying = true;
    defaultProps.datasource.api.describeLogGroups = jest
      .fn()
      .mockResolvedValue([{ value: { arn: 'arn', name: 'loggroupname' } }]);
    render(<LogGroupsField {...defaultProps} logGroups={[{ arn: 'arn', name: 'loggroupname' }]} />);
    await waitFor(() => expect(screen.getByText('Select Log Groups')).toBeInTheDocument());
    expect(defaultProps.datasource.api.describeLogGroups).not.toHaveBeenCalled();
    expect(defaultProps.onChange).not.toHaveBeenCalled();
  });
});
