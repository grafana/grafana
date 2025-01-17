import * as e2e from '@grafana/e2e-selectors';
import { expect, test } from '@grafana/plugin-e2e';

test.describe('Loki editor', () => {
  test.only('Autocomplete features should work as expected.', async ({ page }) => {
    // Go to loki datasource in explore
    await page.goto(
      '/explore?schemaVersion=1&panes=%7B%22iap%22:%7B%22datasource%22:%22gdev-loki%22,%22queries%22:%5B%7B%22refId%22:%22A%22,%22expr%22:%22%22,%22queryType%22:%22range%22,%22datasource%22:%7B%22type%22:%22loki%22,%22uid%22:%22gdev-loki%22%7D,%22editorMode%22:%22code%22%7D%5D,%22range%22:%7B%22from%22:%22now-1h%22,%22to%22:%22now%22%7D%7D%7D&orgId=1'
    );

    // assert that the query builder is shown by default
    await expect(page.getByText('Label filters')).toHaveCount(1);

    // switch to code editor
    await page.getByLabel('Code').click();

    // Waits for monaco to load?
    await page.waitForFunction(() => window.monaco);

    // Assert
    const queryEditor = page.getByTestId(e2e.selectors.components.QueryField.container);
    await expect(queryEditor).toHaveCount(1);

    await queryEditor.click();
    await page.keyboard.type('time(');

    await page.pause();
    await expect(queryEditor).toContainText('time()');

    await expect(queryEditor).toHaveCount(1);

    // code editor

    // autocompletes paren
    // .type('time(');
    // expect($el.val()).to.eq('time()');

    // removes closing brace when opening brace is removed

    // e2e.components.QueryField.container().type('{selectall}{backspace}avg_over_time({backspace}');
    // cy.get('.monaco-editor textarea:first').should(($el) => {
    //   expect($el.val()).to.eq('avg_over_time');
    // });

    //    // keeps closing brace when opening brace is removed and inner values exist
    //     e2e.components.QueryField.container().type(
    //       '{selectall}{backspace}time(test{leftArrow}{leftArrow}{leftArrow}{leftArrow}{backspace}'
    //     );
    //     cy.get('.monaco-editor textarea:first').should(($el) => {
    //       expect($el.val()).to.eq('timetest)');
    //     });

    //     // overrides an automatically inserted brace
    //     e2e.components.QueryField.container().type('{selectall}{backspace}time()');
    //     cy.get('.monaco-editor textarea:first').should(($el) => {
    //       expect($el.val()).to.eq('time()');
    //     });

    //       // does not override manually inserted braces
    //     e2e.components.QueryField.container().type('{selectall}{backspace}))');
    //     cy.get('.monaco-editor textarea:first').should(($el) => {
    //       expect($el.val()).to.eq('))');
    //     });

    //   // Should execute the query when enter with shift is pressed
    //     e2e.components.QueryField.container().type('{selectall}{backspace}{shift+enter}');
    //     cy.get('[data-testid="explore-no-data"]').should('be.visible');
    //
    //     /** Suggestions plugin */
    //     e2e.components.QueryField.container().type('{selectall}av');
    //     cy.contains('avg').should('be.visible');
    //     cy.contains('avg_over_time').should('be.visible');
  });
});
