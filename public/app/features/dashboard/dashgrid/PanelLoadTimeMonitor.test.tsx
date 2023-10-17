import { render } from '@testing-library/react';
import React from 'react';

const mockPushMeasurement = jest.fn();

import { PanelLoadTimeMonitor } from './PanelLoadTimeMonitor';

jest.mock('app/core/config', () => ({
  config: {
    grafanaJavascriptAgent: {
      enabled: true,
    },
  },
}));

jest.mock('@grafana/faro-web-sdk', () => ({
  faro: {
    api: {
      pushMeasurement: mockPushMeasurement,
    },
  },
}));

describe('PanelLoadTimeMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('logs load time measurement on render', () => {
    jest.useFakeTimers();

    const props = {
      isInPanelEdit: true,
      panelType: 'timeseries',
      panelId: 1,
      panelTitle: 'Panel Title',
      panelOptions: {},
      panelFieldConfig: {
        defaults: {},
        overrides: [],
      },
    };

    render(<PanelLoadTimeMonitor {...props} />);

    jest.runAllTimers();

    expect(mockPushMeasurement).toHaveBeenCalledTimes(1);
  });
});
