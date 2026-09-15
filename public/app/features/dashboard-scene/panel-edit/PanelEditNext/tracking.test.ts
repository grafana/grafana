import { faro } from '@grafana/faro-web-sdk';
import { reportInteraction } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { trackEditorVersionToggle } from './tracking';

jest.mock('@grafana/faro-web-sdk', () => ({
  faro: {
    api: {
      pushEvent: jest.fn(),
    },
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const mockPushEvent = jest.mocked(faro.api.pushEvent);
const mockReportInteraction = jest.mocked(reportInteraction);

describe('trackEditorVersionToggle', () => {
  afterEach(() => {
    setTestFlags({});
    jest.clearAllMocks();
  });

  it.each([
    ['upgrade', false],
    ['upgrade', true],
    ['downgrade', false],
    ['downgrade', true],
  ] as const)('dual-writes direction=%s with paneledit.buttonLabels=%s', (direction, buttonLabelsEnabled) => {
    setTestFlags({ [FlagKeys.PaneleditButtonLabels]: buttonLabelsEnabled });

    trackEditorVersionToggle(direction);

    const payload = {
      action: 'toggle_editor_version',
      direction,
      'paneledit.buttonLabels': String(buttonLabelsEnabled),
    };
    expect(mockPushEvent).toHaveBeenCalledWith('grafana_panel_edit_next_interaction', payload);
    expect(mockReportInteraction).toHaveBeenCalledWith('grafana_panel_edit_next_interaction', payload);
  });
});
