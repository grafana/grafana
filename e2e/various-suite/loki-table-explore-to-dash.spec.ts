import { e2e } from '../utils';

const dataSourceName = 'LokiEditor';
const addDataSource = () => {
  e2e.flows.addDataSource({
    type: 'Loki',
    expectedAlertMessage: 'Unable to connect with Loki. Please check the server logs for more details.',
    name: dataSourceName,
    form: () => {
      cy.get('#connection-url').type('http://loki-url:3100');
    },
  });
};

const lokiQueryResult = {
  status: 'success',
  results: {
    A: {
      status: 200,
      frames: [
        {
          schema: {
            refId: 'A',
            meta: {
              typeVersion: [0, 0],
              custom: {
                frameType: 'LabeledTimeValues',
              },
              stats: [
                {
                  displayName: 'Summary: bytes processed per second',
                  unit: 'Bps',
                  value: 223921,
                },
                {
                  displayName: 'Summary: lines processed per second',
                  value: 1346,
                },
                {
                  displayName: 'Summary: total bytes processed',
                  unit: 'decbytes',
                  value: 4156,
                },
                {
                  displayName: 'Summary: total lines processed',
                  value: 25,
                },
                {
                  displayName: 'Summary: exec time',
                  unit: 's',
                  value: 0.01856,
                },
                {
                  displayName: 'Ingester: total reached',
                  value: 1,
                },
                {
                  displayName: 'Ingester: total chunks matched',
                  value: 12,
                },
                {
                  displayName: 'Ingester: total batches',
                  value: 1,
                },
                {
                  displayName: 'Ingester: total lines sent',
                  value: 1,
                },
                {
                  displayName: 'Ingester: head chunk bytes',
                  unit: 'decbytes',
                  value: 0,
                },
                {
                  displayName: 'Ingester: head chunk lines',
                  value: 0,
                },
                {
                  displayName: 'Ingester: decompressed bytes',
                  unit: 'decbytes',
                  value: 0,
                },
                {
                  displayName: 'Ingester: decompressed lines',
                  value: 0,
                },
                {
                  displayName: 'Ingester: compressed bytes',
                  unit: 'decbytes',
                  value: 0,
                },
                {
                  displayName: 'Ingester: total duplicates',
                  value: 0,
                },
              ],
              executedQueryString: 'Expr: {age="new"}',
            },
            fields: [
              {
                name: 'labels',
                type: 'other',
                typeInfo: {
                  frame: 'json.RawMessage',
                },
              },
              {
                name: 'Time',
                type: 'time',
                typeInfo: {
                  frame: 'time.Time',
                },
              },
              {
                name: 'Line',
                type: 'string',
                typeInfo: {
                  frame: 'string',
                },
              },
              {
                name: 'tsNs',
                type: 'string',
                typeInfo: {
                  frame: 'string',
                },
              },
              {
                name: 'id',
                type: 'string',
                typeInfo: {
                  frame: 'string',
                },
              },
            ],
          },
          data: {
            values: [
              [
                {
                  age: 'new',
                  instance: 'server\\1',
                  job: '"grafana/data"',
                  nonIndexed: 'value',
                  place: 'moon',
                  re: 'one.two$three^four',
                  source: 'data',
                },
              ],
              [1700077283237],
              [
                '{"_entry":"log text with ANSI \\u001b[31mpart of the text\\u001b[0m [149702545]","counter":"22292","float":"NaN","wave":-0.5877852522916832,"label":"val3","level":"info"}',
              ],
              ['1700077283237000000'],
              ['1700077283237000000_9b025d35'],
            ],
          },
        },
      ],
    },
  },
};

describe('Loki Query Editor', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  afterEach(() => {
    e2e.flows.revertAllChanges();
  });

  beforeEach(() => {
    cy.window().then((win) => {
      win.localStorage.setItem('grafana.featureToggles', 'logsExploreTableVisualisation=1');
    });
    e2e.flows.revertAllChanges();
  });
  it('Should be able to add explore table to dashboard', () => {
    addDataSource();

    cy.intercept(/labels?/, (req) => {
      req.reply({ status: 'success', data: ['instance', 'job', 'source'] });
    });

    cy.intercept(/series?/, (req) => {
      req.reply({ status: 'success', data: [{ instance: 'instance1' }] });
    });

    cy.intercept(/\/api\/ds\/query\?ds_type=loki?/, (req) => {
      req.reply(lokiQueryResult);
    });

    // Go to Explore and choose Loki data source
    e2e.pages.Explore.visit();
    e2e.components.DataSourcePicker.container().should('be.visible').click();
    cy.contains(dataSourceName).scrollIntoView().should('be.visible').click();

    cy.contains('Code').click();

    // Wait for lazy loading
    const monacoLoadingText = 'Loading...';

    e2e.components.QueryField.container().should('be.visible').should('have.text', monacoLoadingText);
    e2e.components.QueryField.container().should('be.visible').should('not.have.text', monacoLoadingText);

    // Write a simple query
    e2e.components.QueryField.container().type('query').type('{instance="instance1"');
    cy.get('.monaco-editor textarea:first').should(($el) => {
      expect($el.val()).to.eq('query{instance="instance1"}');
    });

    // Submit the query
    e2e.components.QueryField.container().type('{shift+enter}');
    // Assert the no-data message is not visible
    cy.get('[data-testid="explore-no-data"]').should('not.exist');

    // Click on the table toggle
    cy.contains('Table').click();

    // One row with two cells
    cy.get('[role="cell"]').should('have.length', 2);

    const label = cy.contains('label', 'age');

    label.should('be.visible');
    label.click();
    label.find('input[type="checkbox"]').should('be.checked');

    const exploreCells = cy.get('[role="cell"]');

    // Now we should have a row with 3 columns
    exploreCells.should('have.length', 3);
    // And a value of "new"
    exploreCells.should('contain', 'new');

    const addToDashboardButton = cy.get('[aria-label="Add to dashboard"]');

    // Now let's add this to a dashboard
    addToDashboardButton.should('be.visible');
    addToDashboardButton.click();

    const addPanelToDashboardButton = cy.contains('Add panel to dashboard');
    addPanelToDashboardButton.should('be.visible');

    const openDashboardButton = cy.contains('Open dashboard');
    openDashboardButton.should('be.visible');
    openDashboardButton.click();

    const panel = cy.get('[data-panelid="1"]');
    panel.should('be.visible');

    const cells = panel.find('[role="table"] [role="cell"]');
    // Should have 3 columns
    cells.should('have.length', 3);
    // Time column has correct value
    cells.contains('2023-11-15 09:41:23');

    // "age" column has correct value of "new", need to requery the DOM because of the .contains call above
    cy.get('[data-panelid="1"]').find('[role="table"] [role="cell"]').contains('new');
  });
});
