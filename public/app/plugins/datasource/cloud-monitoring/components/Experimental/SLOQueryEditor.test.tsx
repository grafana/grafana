import { render, screen, act } from '@testing-library/react';
import React from 'react';

import { config } from '@grafana/runtime';
import { TemplateSrvMock } from 'app/features/templating/template_srv.mock';

import { createMockDatasource } from '../../__mocks__/cloudMonitoringDatasource';
import { createMockSLOQuery } from '../../__mocks__/cloudMonitoringQuery';

import { SLOQueryEditor, Props } from './SLOQueryEditor';

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
  query: createMockSLOQuery(),
};

describe('Cloud monitoring: SLO Query Editor', () => {
  it('shoud render Service selector', async () => {
    await act(async () => {
      const originalValue = config.featureToggles.cloudMonitoringExperimentalUI;
      config.featureToggles.cloudMonitoringExperimentalUI = true;

      render(<SLOQueryEditor {...props} />);

      expect(screen.getByLabelText('Service')).toBeInTheDocument();

      config.featureToggles.cloudMonitoringExperimentalUI = originalValue;
    });
  });
});
