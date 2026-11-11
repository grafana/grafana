import { faro } from '@grafana/faro-web-sdk';
import { reportInteraction } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { QueryEditorType } from './constants';
import {
  type CardActionSource,
  trackEditorVersionToggle,
  trackQueryMenuAction,
  trackTransformationToolAction,
} from './tracking';

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

describe.each([
  [
    'trackQueryMenuAction',
    (source?: CardActionSource) => trackQueryMenuAction('duplicate', QueryEditorType.Query, source),
  ],
  [
    'trackTransformationToolAction',
    (source?: CardActionSource) => trackTransformationToolAction('toggle_help', source),
  ],
])('%s', (_, track) => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('includes the source when given', () => {
    track('stacked_header');

    expect(mockReportInteraction.mock.calls[0][1]).toHaveProperty('source', 'stacked_header');
  });

  it('omits the source when not given', () => {
    track();

    expect(mockReportInteraction.mock.calls[0][1]).not.toHaveProperty('source');
  });
});
