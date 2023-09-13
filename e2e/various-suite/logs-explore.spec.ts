import { Components } from '@grafana/e2e-selectors/src';

import { e2e } from '../utils';

enum LogLevel {
  emerg = 'critical',
  fatal = 'critical',
  alert = 'critical',
  crit = 'critical',
  critical = 'critical',
  warn = 'warning',
  warning = 'warning',
  err = 'error',
  eror = 'error',
  error = 'error',
  info = 'info',
  information = 'info',
  informational = 'info',
  notice = 'info',
  dbug = 'debug',
  debug = 'debug',
  trace = 'trace',
  unknown = 'unknown',
}

// Importing into the spec isn't working, so we'll just copy the code here for now.
function getLogLevel(line: string): LogLevel {
  if (!line) {
    return LogLevel.unknown;
  }
  let level = LogLevel.unknown;
  let currentIndex: number | undefined = undefined;

  for (const [key, value] of Object.entries(LogLevel)) {
    const regexp = new RegExp(`\\b${key}\\b`, 'i');
    const result = regexp.exec(line);

    if (result) {
      if (currentIndex === undefined || result.index < currentIndex) {
        level = value;
        currentIndex = result.index;
      }
    }
  }
  return level;
}

describe('Logs panels in explore', () => {
  beforeEach(() => {
    e2e.flows.login(e2e.env('USERNAME'), e2e.env('PASSWORD'));

    e2e.pages.Explore.visit();
    // e2e.pages.Explore.General.container().should('have.length', 1);
    // e2e.components.RefreshPicker.runButtonV2().should('have.length', 1);

    // delete query history queries that would be unrelated
    e2e.components.QueryTab.queryHistoryButton().should('be.visible').click();
    cy.get('button[title="Delete query"]').each((button) => {
      button.trigger('click');
    });
    cy.get('button[title="Delete query"]').should('not.exist');
    e2e.components.QueryTab.queryHistoryButton().should('be.visible').click();

    e2e.components.DataSource.TestData.LogsTab.scenarioSelectContainer()
      .scrollIntoView()
      .should('be.visible')
      .within(() => {
        cy.get('input[id*="test-data-scenario-select-"]').should('be.visible').click();
      });

    cy.contains('Logs').scrollIntoView().should('be.visible').click();

    const canvases = cy.get('canvas');
    canvases.should('have.length', 1);

    // Both queries above should have been run and be shown in the query history
    e2e.components.QueryTab.queryHistoryButton().should('be.visible').click();
    e2e.components.QueryHistory.queryText().should('have.length', 1).should('contain', 'logs');

    // delete all queries
    cy.get('button[title="Delete query"]').each((button) => {
      button.trigger('click');
    });

    e2e.components.QueryTab.queryHistoryButton().should('be.visible').click();

    // Query history is wrapped up, now time to test logs
  });

  it('logs panel and logs volume should load in explore', () => {
    // This simply asserts that the logs volume container is present
    e2e.components.Panels.Visualization.LogsVolume.container().should('have.length', 1);
    e2e.components.Panels.Visualization.LogsVolume.container().should(
      'include.text',
      'gdev-testdata. This datasource does not support full-range histograms. The graph below is based on the logs seen in the response.'
    );

    e2e.components.Panels.Visualization.Logs.container().should('have.length', 1);
    cy.get(Components.Panels.Visualization.Logs.rows).find('tr').should('have.length', 10);

    // All of the sample logs contain msg="Request Completed"
    cy.get(Components.Panels.Visualization.Logs.rows).find('tr').should('include.text', 'msg="Request Completed"');
    // overkill, looping through all
    cy.get(Components.Panels.Visualization.Logs.rows)
      .find('tr')
      .each((row) => {
        cy.wrap(row).should('include.text', 'msg="Request Completed"');
      });
  });

  it('logs panel should load older logs', () => {
    cy.get(Components.Panels.Visualization.Logs.rows).find('tr').should('have.length', 10);
    // get the current oldest log (top)

    // @todo https://docs.cypress.io/faq/questions/using-cypress-faq#How-do-I-get-an-elements-text-contents
    // get first log line, invoke text, then click on load more button and compare the dates

    // Click to add more logs
    cy.get(Components.Panels.Visualization.Logs.Buttons.olderLogs).should('have.length', 1).click();

    // This is not helpful, there are always 10 logs. We need to check the dates of them.
    cy.get(Components.Panels.Visualization.Logs.rows).find('tr').should('have.length', 10);
  });
});
