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

describe('Explore', () => {
  beforeEach(() => {
    e2e.flows.login(e2e.env('USERNAME'), e2e.env('PASSWORD'));
  });

  it('Basic path through Explore.', () => {
    e2e.pages.Explore.visit();
    e2e.pages.Explore.General.container().should('have.length', 1);
    e2e.components.RefreshPicker.runButtonV2().should('have.length', 1);

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

    // This simply asserts that the logs volume container is present
    e2e.components.Panels.Visualization.LogsVolume.container().should('have.length', 1);
    e2e.components.Panels.Visualization.LogsVolume.container().should(
      'include.text',
      'gdev-testdata. This datasource does not support full-range histograms. The graph below is based on the logs seen in the response.'
    );

    e2e.components.Panels.Visualization.Logs.container().should('have.length', 1);
    cy.get(Components.Panels.Visualization.Logs.rows).should('have.length', 1);
    // All of the sample logs should contain
    cy.get(Components.Panels.Visualization.Logs.rows).find('tr').should('include.text', 'msg="Request Completed"');
    // overkill, looping through all
    cy.get(Components.Panels.Visualization.Logs.rows)
      .find('tr')
      .each((row) => {
        cy.wrap(row).should('include.text', 'msg="Request Completed"');
      });

    // Get all of the levels from the log volume graph
    cy.get(`[aria-label^="${Components.Panels.Visualization.LogsVolume.Legend.wrapperPartial}"]`).each((legend) => {
      // Click on the legend to filter the logs
      cy.wrap(legend).should('be.visible').click();

      // Now only some of the logs will be visible that are associated with this lvl
      cy.get(Components.Panels.Visualization.Logs.rows)
        .find('tr')
        .each((row) => {
          // Get the log level of the legend text
          const lvlValue = getLogLevel(legend.text());
          // And check that the log level of each row matches the log level of the legend
          expect(getLogLevel(row.text())).to.be.eq(lvlValue);
        });

      // Click on the legend again to remove the filter
      cy.wrap(legend).should('be.visible').click();
    });
  });
});
