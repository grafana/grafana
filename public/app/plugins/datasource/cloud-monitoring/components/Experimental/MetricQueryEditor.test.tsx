import { render, screen, act } from '@testing-library/react';
import React from 'react';

import { config } from '@grafana/runtime';
import { TemplateSrvMock } from 'app/features/templating/template_srv.mock';

import { createMockDatasource } from '../../__mocks__/cloudMonitoringDatasource';
import { createMockMetricQuery } from '../../__mocks__/cloudMonitoringQuery';

import { MetricQueryEditor, Props } from './MetricQueryEditor';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => new TemplateSrvMock({}),
}));

const props: Props = {
  onChange: jest.fn(),
  refId: 'refId',
  customMetaData: {},
  onRunQuery: jest.fn(),
  datasource: createMockDatasource(),
  variableOptionGroup: { options: [] },
  query: createMockMetricQuery(),
};

describe('Cloud monitoring: Metric Query Editor', () => {
  it('shoud render Project selector', async () => {
    await act(async () => {
      const originalValue = config.featureToggles.cloudMonitoringExperimentalUI;
      config.featureToggles.cloudMonitoringExperimentalUI = true;

      render(<MetricQueryEditor {...props} />);

      expect(screen.getByLabelText('Project')).toBeInTheDocument();

      config.featureToggles.cloudMonitoringExperimentalUI = originalValue;
    });
  });
});
