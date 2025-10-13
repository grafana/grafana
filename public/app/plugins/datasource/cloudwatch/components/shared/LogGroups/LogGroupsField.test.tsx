import { render, screen, waitFor } from '@testing-library/react';
// eslint-disable-next-line lodash/import-scope
import lodash from 'lodash';

import { config } from '@grafana/runtime';

import {
  logGroupNamesVariable,
  setupMockedDataSource,
  setupMockedTemplateService,
} from '../../../__mocks__/CloudWatchDataSource';

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

  it('should call getLogGroups to get associated log group arns and then update props if rendered with legacy log group names', async () => {
    config.featureToggles.cloudWatchCrossAccountQuerying = true;
    defaultProps.datasource.resources.getLogGroups = jest
      .fn()
      .mockResolvedValue([{ value: { arn: 'arn', name: 'loggroupname' } }]);
    defaultProps.datasource.resources.templateSrv = setupMockedTemplateService();
    render(<LogGroupsField {...defaultProps} legacyLogGroupNames={['loggroupname']} />);

    await waitFor(async () => expect(screen.getByText('Select log groups')).toBeInTheDocument());
    expect(defaultProps.datasource.resources.getLogGroups).toHaveBeenCalledWith({
      region: defaultProps.region,
      logGroupNamePrefix: 'loggroupname',
    });
    expect(defaultProps.onChange).toHaveBeenCalledWith([{ arn: 'arn', name: 'loggroupname' }]);
  });

  it('should not call getLogGroups to get associated log group arns for template variables that were part of the legacy log group names array, only include them in the call to onChange', async () => {
    config.featureToggles.cloudWatchCrossAccountQuerying = true;
    defaultProps.datasource = setupMockedDataSource({ variables: [logGroupNamesVariable] }).datasource;
    defaultProps.datasource.resources.getLogGroups = jest
      .fn()
      .mockResolvedValue([{ value: { arn: 'arn', name: 'loggroupname' } }]);
    const varName = '$' + logGroupNamesVariable.name;
    render(<LogGroupsField {...defaultProps} legacyLogGroupNames={['loggroupname', varName]} />);

    await waitFor(async () => expect(screen.getByText('Select log groups')).toBeInTheDocument());
    expect(defaultProps.datasource.resources.getLogGroups).toHaveBeenCalledTimes(1);
    expect(defaultProps.datasource.resources.getLogGroups).toHaveBeenCalledWith({
      region: defaultProps.region,
      logGroupNamePrefix: 'loggroupname',
    });
    expect(defaultProps.onChange).toHaveBeenCalledWith([
      { arn: 'arn', name: 'loggroupname' },
      { arn: varName, name: varName },
    ]);
  });

  it('should not call getLogGroups and update props if rendered with log groups', async () => {
    config.featureToggles.cloudWatchCrossAccountQuerying = true;
    defaultProps.datasource.resources.getLogGroups = jest
      .fn()
      .mockResolvedValue([{ value: { arn: 'arn', name: 'loggroupname' } }]);
    defaultProps.datasource.resources.templateSrv = setupMockedTemplateService();
    render(<LogGroupsField {...defaultProps} logGroups={[{ arn: 'arn', name: 'loggroupname' }]} />);
    await waitFor(() => expect(screen.getByText('Select log groups')).toBeInTheDocument());
    expect(defaultProps.datasource.resources.getLogGroups).not.toHaveBeenCalled();
    expect(defaultProps.onChange).not.toHaveBeenCalled();
  });
});
