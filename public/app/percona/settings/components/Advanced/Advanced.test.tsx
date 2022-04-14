import React from 'react';
import { Advanced } from './Advanced';
import { sttCheckIntervalsStub } from './__mocks__/stubs';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

describe('Advanced::', () => {
  it('Renders correctly with props', () => {
    render(
      <Advanced
        dataRetention="1296000s"
        telemetryEnabled={false}
        sttEnabled={false}
        backupEnabled={false}
        updatesDisabled
        updateSettings={() => {}}
        publicAddress="pmmtest.percona.com"
        sttCheckIntervals={sttCheckIntervalsStub}
      />
    );
    const retentionInput = screen.getByTestId('retention-number-input');
    const publicAddressInput = screen.getByTestId('publicAddress-text-input');

    expect(retentionInput).toHaveValue(15);
    expect(publicAddressInput).toHaveValue('pmmtest.percona.com');
  });

  it('Calls apply changes', () => {
    const updateSettings = jest.fn();
    render(
      <Advanced
        dataRetention="1296000s"
        telemetryEnabled={false}
        sttEnabled={false}
        backupEnabled={false}
        updatesDisabled
        updateSettings={updateSettings}
        sttCheckIntervals={sttCheckIntervalsStub}
      />
    );

    const retentionInput = screen.getByTestId('retention-number-input');
    fireEvent.change(retentionInput, { target: { value: '70' } });

    const form = screen.getByTestId('advanced-form');
    fireEvent.submit(form);

    expect(updateSettings).toHaveBeenCalled();
  });

  it('Sets correct URL from browser', async () => {
    const location = {
      ...window.location,
      host: 'localhost:1234',
    };

    Object.defineProperty(window, 'location', {
      writable: true,
      value: location,
    });

    render(
      <Advanced
        dataRetention="1296000s"
        telemetryEnabled={false}
        sttEnabled={false}
        backupEnabled={false}
        updatesDisabled
        updateSettings={() => {}}
        sttCheckIntervals={sttCheckIntervalsStub}
      />
    );
    const publicAddressButton = screen.getByTestId('public-address-button');

    await waitFor(() => fireEvent.click(publicAddressButton));

    const publicAddressInput = screen.getByTestId('publicAddress-text-input');

    expect(publicAddressInput).toHaveValue('localhost:1234');
  });

  it('Does not include STT check intervals in the change request if STT checks are disabled', () => {
    const fakeUpdateSettings = jest.fn();

    render(
      <Advanced
        backupEnabled={false}
        dataRetention="1296000s"
        telemetryEnabled={false}
        sttEnabled={false}
        updatesDisabled
        updateSettings={fakeUpdateSettings}
        sttCheckIntervals={sttCheckIntervalsStub}
      />
    );

    const form = screen.getByTestId('advanced-form');
    fireEvent.submit(form);

    expect(fakeUpdateSettings.mock.calls[0][0].stt_check_intervals).toBeUndefined();
  });

  it('Includes STT check intervals in the change request if STT checks are enabled', () => {
    const fakeUpdateSettings = jest.fn();

    render(
      <Advanced
        backupEnabled={false}
        dataRetention="1296000s"
        telemetryEnabled={false}
        sttEnabled={true}
        updatesDisabled
        updateSettings={fakeUpdateSettings}
        sttCheckIntervals={sttCheckIntervalsStub}
      />
    );

    const form = screen.getByTestId('advanced-form');
    fireEvent.submit(form);
    expect(fakeUpdateSettings.mock.calls[0][0].stt_check_intervals).toBeDefined();
  });
});
