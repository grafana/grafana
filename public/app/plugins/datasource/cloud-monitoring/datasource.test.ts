import { get, set } from 'lodash';

import * as ts from 'app/features/templating/template_srv';

import { createMockQuery } from './__mocks__/cloudMonitoringQuery';
import { createMockInstanceSetttings } from './__mocks__/instanceSettings';
import { createTemplateVariables } from './__mocks__/utils';
import Datasource from './datasource';

const templateSrv = new ts.TemplateSrv();

describe('Cloud Monitoring Datasource', () => {
  describe('interpolateVariablesInQueries', () => {
    beforeEach(() => {
      templateSrv.init([]);
    });

    it('should leave a query unchanged if there are no template variables', () => {
      const mockInstanceSettings = createMockInstanceSetttings();
      const ds = new Datasource(mockInstanceSettings);
      const query = createMockQuery({ hide: false });
      const templateVariablesApplied = ds.interpolateVariablesInQueries([query], {});
      expect(templateVariablesApplied[0]).toEqual(query);
    });

    it('should correctly apply template variables', () => {
      const templateVariables = createTemplateVariables(['metricQuery.projectName']);
      templateSrv.init(Array.from(templateVariables.values()).map((item) => item.templateVariable));
      const mockInstanceSettings = createMockInstanceSetttings();
      const ds = new Datasource(mockInstanceSettings, templateSrv);
      const query = createMockQuery({ hide: false });
      for (const [path, templateVariable] of templateVariables.entries()) {
        set(query, path, `$${templateVariable.variableName}`);
      }
      const templatedQuery = ds.interpolateVariablesInQueries([query], {});
      expect(templatedQuery[0]).toHaveProperty('datasource');
      for (const [path, templateVariable] of templateVariables.entries()) {
        expect(get(templatedQuery[0], path)).toEqual(templateVariable.templateVariable.current.value);
      }
    });
  });
});
