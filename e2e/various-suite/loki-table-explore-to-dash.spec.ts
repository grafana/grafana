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
                  displayName: 'Summary: total bytes processed',
                  unit: 'decbytes',
                  value: 4156,
                },
                {
                  displayName: 'Summary: exec time',
                  unit: 's',
                  value: 0.01856,
                },
              ],
              executedQueryString: 'Expr: {targetLabelName="targetLabelValue"}',
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
                  targetLabelName: 'targetLabelValue',
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
    cy.setLocalStorage('grafana.featureToggles', 'logsExploreTableVisualisation=1');
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

    cy.contains('Code').click({ force: true });

    // Wait for lazy loading
    // const monacoLoadingText = 'Loading...';

    // e2e.components.QueryField.container().should('be.visible').should('have.text', monacoLoadingText);
    e2e.components.QueryField.container()
      .find('.view-overlays[role="presentation"]')
      .get('.cdr')
      .then(($el) => {
        const win = $el[0].ownerDocument.defaultView;
        const after = win.getComputedStyle($el[0], '::after');
        const content = after.getPropertyValue('content');
        expect(content).to.eq('"Enter a Loki query (run with Shift+Enter)"');
      });

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
    cy.contains('Table').click({ force: true });

    // One row with two cells
    cy.get('[role="cell"]').should('have.length', 2);

    cy.contains('label', 'targetLabelName').scrollIntoView();
    cy.contains('label', 'targetLabelName').should('be.visible');
    cy.contains('label', 'targetLabelName').click();
    cy.contains('label', 'targetLabelName').within(() => {
      cy.get('input[type="checkbox"]').check({ force: true });
    });

    cy.contains('label', 'targetLabelName').within(() => {
      cy.get('input[type="checkbox"]').should('be.checked');
    });

    const exploreCells = cy.get('[role="cell"]');

    // Now we should have a row with 3 columns
    exploreCells.should('have.length', 3);
    // And a value of "targetLabelValue"
    exploreCells.should('contain', 'targetLabelValue');

    const addToButton = cy.get('[aria-label="Add"]');
    addToButton.should('be.visible');
    addToButton.click();

    const addToDashboardButton = cy.get('[aria-label="Add to dashboard"]');

    // Now let's add this to a dashboard
    addToDashboardButton.should('be.visible');
    addToDashboardButton.click();

    const addPanelToDashboardButton = cy.contains('Add panel to dashboard');
    addPanelToDashboardButton.should('be.visible');

    const openDashboardButton = cy.contains('Open dashboard');
    openDashboardButton.should('be.visible');
    openDashboardButton.click();

    const panel = cy.get('[data-viz-panel-key="panel-1"]');
    panel.should('be.visible');

    const cells = panel.find('[role="table"] [role="cell"]');
    // Should have 3 columns
    cells.should('have.length', 3);
    // Cells contain strings found in log line
    cells.contains('"wave":-0.5877852522916832');

    // column has correct value of "targetLabelValue", need to requery the DOM because of the .contains call above
    cy.get('[data-viz-panel-key="panel-1"]').find('[role="table"] [role="cell"]').contains('targetLabelValue');
  });
});
