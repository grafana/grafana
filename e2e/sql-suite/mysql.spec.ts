import { e2e } from '@grafana/e2e';

import datasetResponse from './datasets-response.json';
import fieldsResponse from './fields-response.json';
import tablesResponse from './tables-response.json';

describe('MySQL datasource', () => {
  it('code editor autocomplete should work', () => {
    e2e.flows.login('admin', 'admin');

    e2e().intercept('POST', '**/api/ds/query', (req) => {
      if (req.body.queries[0].refId === 'datasets') {
        req.alias = 'datasets';
        req.reply({
          body: datasetResponse,
        });
      } else if (req.body.queries[0].refId === 'tables') {
        req.alias = 'tables';
        req.reply({
          body: tablesResponse,
        });
      } else if (req.body.queries[0].refId === 'fields') {
        req.alias = 'fields';
        req.reply({
          body: fieldsResponse,
        });
      }
    });

    e2e.pages.Explore.visit();

    e2e.components.DataSourcePicker.container().should('be.visible').type('gdev-mysql{enter}');

    e2e().get("label[for^='option-code']").should('be.visible').click();
    e2e().get('textarea').type('S{downArrow}{enter}');
    e2e().wait('@tables');
    e2e().get('.suggest-widget').contains('`table-name-that-needs-quotes`').should('be.visible');
    e2e().get('textarea').type('{enter}');
    e2e().get('textarea').should('have.value', `SELECT  FROM grafana.\`table-name-that-needs-quotes\``);
  });
});
