import React from 'react';
import { mount } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { Advanced } from './Advanced';

describe('Advanced::', () => {
  it('Renders correctly with props', () => {
    const root = mount(
      <Advanced
        dataRetention="1296000s"
        telemetryEnabled={false}
        sttEnabled={false}
        updatesDisabled
        updateSettings={() => {}}
        publicAddress="pmmtest.percona.com"
      />
    );
    const retentionInput = root.find(dataQa('retention-field-container')).find('input');
    const publicAddressInput = root.find(dataQa('publicAddress-text-input')).find('input');

    expect(retentionInput.prop('value')).toEqual(15);
    expect(publicAddressInput.prop('value')).toEqual('pmmtest.percona.com');
  });

  it("Can't change telemetry when stt is on", () => {
    const root = mount(
      <Advanced dataRetention="1296000s" telemetryEnabled sttEnabled updatesDisabled updateSettings={() => {}} />
    );
    const telemetrySwitch = root.find('[data-qa="advanced-telemetry"]').find('input');

    expect(telemetrySwitch.prop('disabled')).toBeTruthy();
  });

  it("Can't change stt when telemetry is off", () => {
    const root = mount(
      <Advanced
        dataRetention="1296000s"
        telemetryEnabled={false}
        sttEnabled={false}
        updatesDisabled
        updateSettings={() => {}}
      />
    );
    const sttSwitch = root.find('[data-qa="advanced-stt"]').find('input');

    expect(sttSwitch.prop('disabled')).toBeTruthy();
  });

  it("Can't change alerting when telemetry is off", () => {
    const root = mount(
      <Advanced
        dataRetention="1296000s"
        telemetryEnabled={false}
        sttEnabled={false}
        alertingEnabled={false}
        updatesDisabled
        updateSettings={() => {}}
      />
    );
    const alertingSwitch = root.find('[data-qa="advanced-alerting"]').find('input');

    expect(alertingSwitch.prop('disabled')).toBeTruthy();
  });

  it('Calls apply changes', () => {
    const updateSettings = jest.fn();
    const root = mount(
      <Advanced
        dataRetention="1296000s"
        telemetryEnabled={false}
        sttEnabled={false}
        updatesDisabled
        updateSettings={updateSettings}
      />
    );

    root
      .find('[data-qa="retention-field-container"]')
      .find('input')
      .simulate('change', { target: { value: '70' } });
    root.find('form').simulate('submit');

    expect(updateSettings).toHaveBeenCalled();
  });

  it('Sets correct URL from browser', () => {
    const oldLocation = window.location;

    delete window.location;
    window.location = Object.create({ ...oldLocation, hostname: 'pmmtest.percona.com' });

    const root = mount(
      <Advanced
        dataRetention="1296000s"
        telemetryEnabled={false}
        sttEnabled={false}
        updatesDisabled
        updateSettings={() => {}}
      />
    );
    const publicAddressButton = root.find(dataQa('public-address-button')).find('button');

    publicAddressButton.simulate('click');
    root.update();

    const publicAddressInput = root.find(dataQa('publicAddress-text-input')).find('input');

    expect(publicAddressInput.prop('value')).toEqual('pmmtest.percona.com');
  });
});
