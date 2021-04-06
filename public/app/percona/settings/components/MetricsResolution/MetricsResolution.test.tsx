import React from 'react';
import { mount } from 'enzyme';
import { MetricsResolution } from './MetricsResolution';
import { defaultResolutions } from './MetricsResolution.constants';
import { removeUnits } from './MetricsResolution.utils';
import { dataQa } from '@percona/platform-core';

describe('MetricsResolution::', () => {
  it('Renders correctly with props for standard resolution', () => {
    const root = mount(<MetricsResolution metricsResolutions={defaultResolutions[1]} updateSettings={() => {}} />);
    const lrInput = root.find('[data-qa="lr-number-input"]');
    const mrInput = root.find('[data-qa="mr-number-input"]');
    const hrInput = root.find('[data-qa="hr-number-input"]');
    const standardRes = removeUnits(defaultResolutions[1]);

    expect(lrInput.find('input').prop('value')).toEqual(standardRes.lr);
    expect(mrInput.find('input').prop('value')).toEqual(standardRes.mr);
    expect(hrInput.find('input').prop('value')).toEqual(standardRes.hr);
  });

  it('Renders correctly with props for rare resolution', () => {
    const root = mount(<MetricsResolution metricsResolutions={defaultResolutions[0]} updateSettings={() => {}} />);

    const lrInput = root.find('[data-qa="lr-number-input"]');
    const mrInput = root.find('[data-qa="mr-number-input"]');
    const hrInput = root.find('[data-qa="hr-number-input"]');
    const standardRes = removeUnits(defaultResolutions[0]);

    expect(lrInput.find('input').prop('value')).toEqual(standardRes.lr);
    expect(mrInput.find('input').prop('value')).toEqual(standardRes.mr);
    expect(hrInput.find('input').prop('value')).toEqual(standardRes.hr);
  });

  it('Renders correctly with props for frequent resolution', () => {
    const root = mount(<MetricsResolution metricsResolutions={defaultResolutions[2]} updateSettings={() => {}} />);

    const lrInput = root.find('[data-qa="lr-number-input"]');
    const mrInput = root.find('[data-qa="mr-number-input"]');
    const hrInput = root.find('[data-qa="hr-number-input"]');
    const standardRes = removeUnits(defaultResolutions[2]);

    expect(lrInput.find('input').prop('value')).toEqual(standardRes.lr);
    expect(mrInput.find('input').prop('value')).toEqual(standardRes.mr);
    expect(hrInput.find('input').prop('value')).toEqual(standardRes.hr);
  });

  it('Renders correctly with props for custom resolution', () => {
    const root = mount(
      <MetricsResolution metricsResolutions={{ lr: '400s', mr: '100s', hr: '50s' }} updateSettings={() => {}} />
    );

    const lrInput = root.find('[data-qa="lr-number-input"]');
    const mrInput = root.find('[data-qa="mr-number-input"]');
    const hrInput = root.find('[data-qa="hr-number-input"]');

    expect(lrInput.find('input').prop('value')).toEqual('400');
    expect(mrInput.find('input').prop('value')).toEqual('100');
    expect(hrInput.find('input').prop('value')).toEqual('50');
  });

  it('Changes input values when changing resolution', () => {
    const root = mount(<MetricsResolution metricsResolutions={defaultResolutions[0]} updateSettings={() => {}} />);
    let radio = root.find(dataQa('resolutions-radio-button')).at(2);

    radio.simulate('click');

    const lrInput = root.find('[data-qa="lr-number-input"]');
    const mrInput = root.find('[data-qa="mr-number-input"]');
    const hrInput = root.find('[data-qa="hr-number-input"]');
    const standardRes = removeUnits(defaultResolutions[0]);

    expect(lrInput.find('input').prop('value')).toEqual(standardRes.lr);
    expect(mrInput.find('input').prop('value')).toEqual(standardRes.mr);
    expect(hrInput.find('input').prop('value')).toEqual(standardRes.hr);
  });

  it('Disables apply changes on initial values', () => {
    const root = mount(<MetricsResolution metricsResolutions={defaultResolutions[0]} updateSettings={() => {}} />);
    const button = root.find('button');

    expect(button.prop('disabled')).toBeTruthy();
  });

  it('Calls apply changes', () => {
    const updateSettings = jest.fn();
    const root = mount(
      <MetricsResolution metricsResolutions={defaultResolutions[0]} updateSettings={updateSettings} />
    );

    root
      .find('[data-qa="lr-number-input"]')
      .find('input')
      .simulate('change', { target: { value: '70' } });
    root.find('form').simulate('submit');

    expect(updateSettings).toHaveBeenCalled();
  });
});
