import { get, set } from 'lodash';

import { DataSourceInstanceSettings } from '@grafana/data';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { createMockQuery } from './__mocks__/cloudMonitoringQuery';
import { createMockInstanceSetttings } from './__mocks__/instanceSettings';
import { createTemplateVariables } from './__mocks__/utils';
import Datasource from './datasource';
import { CloudMonitoringOptions } from './types';

const templateSrv = new TemplateSrv();

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),
  getTemplateSrv: () => templateSrv,
}));

interface TestContext {
  instanceSettings: DataSourceInstanceSettings<CloudMonitoringOptions>;
  ds: Datasource;
}

describe('Cloud Monitoring Datasource', () => {
  const ctx: TestContext = {} as TestContext;
  beforeEach(() => {
    jest.clearAllMocks();
    ctx.instanceSettings = createMockInstanceSetttings();
    ctx.ds = new Datasource(ctx.instanceSettings);
  });

  describe('interpolateVariablesInQueries', () => {
    beforeEach(() => {
      templateSrv.init([]);
    });

    it('should leave a query unchanged if there are no template variables', () => {
      const query = createMockQuery({ hide: false });
      const templateVariablesApplied = ctx.ds.interpolateVariablesInQueries([query], {});
      expect(templateVariablesApplied[0]).toEqual(query);
    });

    it('should correctly apply template variables', () => {
      const templateVariables = createTemplateVariables(['metricQuery.projectName']);
      templateSrv.init(Array.from(templateVariables.values()).map((item) => item.templateVariable));

      const query = createMockQuery({ hide: false });
      for (const [path, templateVariable] of templateVariables.entries()) {
        set(query, path, `$${templateVariable.variableName}`);
      }
      const templatedQuery = ctx.ds.interpolateVariablesInQueries([query], {});
      expect(templatedQuery[0]).toHaveProperty('datasource');
      for (const [path, templateVariable] of templateVariables.entries()) {
        expect(get(templatedQuery[0], path)).toEqual(templateVariable.templateVariable.current.value);
      }
    });
  });
});
