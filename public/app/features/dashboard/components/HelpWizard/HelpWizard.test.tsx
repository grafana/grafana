import { render, screen } from '@testing-library/react';
import React from 'react';

import { FieldType, getDefaultTimeRange, LoadingState, toDataFrame } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';

import { PanelModel } from '../../state/PanelModel';

import { HelpWizard } from './HelpWizard';

function setup() {
  const panel = new PanelModel({});
  panel.plugin = getPanelPlugin({});
  panel.getQueryRunner().setLastResult({
    timeRange: getDefaultTimeRange(),
    state: LoadingState.Done,
    series: [
      toDataFrame({
        name: 'http_requests_total',
        fields: [
          { name: 'Time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'Value', type: FieldType.number, values: [11, 22, 33] },
        ],
      }),
    ],
  });
  panel.getQueryRunner().resendLastResult();

  return render(<HelpWizard panel={panel} onClose={() => {}} plugin={panel.plugin} />);
}
describe('SupportSnapshot', () => {
  it('Can render', async () => {
    setup();
    expect(await screen.findByRole('button', { name: 'Dashboard (2.97 KiB)' })).toBeInTheDocument();
  });
});
