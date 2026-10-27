import { expect, test } from '../fixtures';
import { type Panels } from '../page-objects';

import sectionVariablesRowsDashboard from './fixtures/SectionVariablesRowsDashboard.json';
import sectionVariablesTabsDashboard from './fixtures/SectionVariablesTabsDashboard.json';
import { addNewSectionVariable, importVariableTestDashboard, saveAndGotoDashboardUrl } from './helpers/flows';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
});

// Both fixtures define a dashboard-level "SharedVariable" textbox with the value "dashboard",
// and two sections whose panels render "SectionVariable: $SectionVariable | SharedVariable: $SharedVariable".
const sectionVariable = { type: 'textbox', name: 'SectionVariable', label: 'Section variable' };
const dashboardVariableLabel = 'Shared variable';

test.describe(
  'Dashboard edit - section variables',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('scopes row variables to their row, including one shadowing a dashboard variable, and keeps them after a reload', async ({
      page,
      selectors,
      controls,
      sidebar,
      panels,
      rows,
    }) => {
      const viewUrl = await importVariableTestDashboard(page, selectors, panels, sectionVariablesRowsDashboard);
      const { variableOptions } = sidebar;
      const shadowingVariable = { type: 'textbox', name: 'SharedVariable', label: 'Section shared variable' };

      const sectionRowContent = rows.getContent('Section row');

      await controls.enterEditMode();
      await rows.select('Section row');
      await addNewSectionVariable(sidebar, sidebar.rowOptions, sectionVariable);
      await variableOptions.textbox.setValue('section');

      await test.step('Check the row variable control is in the row, not in the controls bar', async () => {
        await expect(
          sectionRowContent.filter({ has: controls.variables.getLabel(sectionVariable.label) }),
          `"Section row" shows the "${sectionVariable.label}" control`
        ).toBeVisible();
        await expect(
          controls.variables.getControls(),
          `Controls bar only shows the "${dashboardVariableLabel}" control`
        ).toHaveText([dashboardVariableLabel]);
      });

      await expectPanelToShowContent(panels, 'Variable output', 'SectionVariable: section | SharedVariable: dashboard');
      // We expect the raw reference because no variable in scope of the other row resolves $SectionVariable.
      await expectPanelToShowContent(
        panels,
        'Outside output',
        'SectionVariable: $SectionVariable | SharedVariable: dashboard'
      );

      await test.step(`Add a row variable that shadows the dashboard variable "${shadowingVariable.name}"`, async () => {
        await rows.select('Section row');
        await addNewSectionVariable(sidebar, sidebar.rowOptions, shadowingVariable);

        await expect(
          variableOptions.getNameWarning(),
          'Name input warns about the shadowed dashboard variable'
        ).toHaveAccessibleName(
          'A variable with this name already exists at the dashboard level. This variable will overwrite it.'
        );

        await variableOptions.textbox.setValue('section-shared');
      });

      await expectPanelToShowContent(
        panels,
        'Variable output',
        'SectionVariable: section | SharedVariable: section-shared'
      );
      await expectPanelToShowContent(
        panels,
        'Outside output',
        'SectionVariable: $SectionVariable | SharedVariable: dashboard'
      );

      await saveAndGotoDashboardUrl(page, controls, viewUrl);

      await expectPanelToShowContent(
        panels,
        'Variable output',
        'SectionVariable: section | SharedVariable: section-shared'
      );
      await expectPanelToShowContent(
        panels,
        'Outside output',
        'SectionVariable: $SectionVariable | SharedVariable: dashboard'
      );

      await test.step('Check both row variable controls are in the row, not in the controls bar', async () => {
        await expect(
          sectionRowContent.filter({ has: controls.variables.getLabel(sectionVariable.label) }),
          `"Section row" shows the "${sectionVariable.label}" control`
        ).toBeVisible();
        await expect(
          sectionRowContent.filter({ has: controls.variables.getLabel(shadowingVariable.label) }),
          `"Section row" shows the "${shadowingVariable.label}" control`
        ).toBeVisible();
        await expect(
          controls.variables.getControls(),
          `Controls bar only shows the "${dashboardVariableLabel}" control`
        ).toHaveText([dashboardVariableLabel]);
      });
    });

    test('scopes a tab variable to its tab and keeps it after a reload', async ({
      page,
      selectors,
      controls,
      sidebar,
      panels,
      tabs,
    }) => {
      const viewUrl = await importVariableTestDashboard(page, selectors, panels, sectionVariablesTabsDashboard);
      const { variableOptions } = sidebar;

      const sectionControlLabel = controls.variables.getLabel(sectionVariable.label);

      await controls.enterEditMode();
      await tabs.select('Section tab');
      await addNewSectionVariable(sidebar, sidebar.tabOptions, sectionVariable);
      await variableOptions.textbox.setValue('section');

      await test.step('Check the tab variable control shows, but not in the controls bar', async () => {
        await expect(sectionControlLabel, `"Section tab" shows the "${sectionVariable.label}" control`).toBeVisible();
        await expect(
          controls.variables.getControls(),
          `Controls bar only shows the "${dashboardVariableLabel}" control`
        ).toHaveText([dashboardVariableLabel]);
      });
      await expectPanelToShowContent(panels, 'Variable output', 'SectionVariable: section | SharedVariable: dashboard');

      // We switch tabs to check the control belongs to its tab, because no element wraps both a tab's variable controls and its grid.
      await tabs.select('Other tab');
      await expectPanelToShowContent(
        panels,
        'Outside output',
        'SectionVariable: $SectionVariable | SharedVariable: dashboard'
      );
      await expect(sectionControlLabel, `"Other tab" hides the "${sectionVariable.label}" control`).toBeHidden();

      await saveAndGotoDashboardUrl(page, controls, viewUrl);

      await test.step('Check the tab variable control shows, but not in the controls bar', async () => {
        await expect(sectionControlLabel, `"Section tab" shows the "${sectionVariable.label}" control`).toBeVisible();
        await expect(
          controls.variables.getControls(),
          `Controls bar only shows the "${dashboardVariableLabel}" control`
        ).toHaveText([dashboardVariableLabel]);
      });
      await expectPanelToShowContent(panels, 'Variable output', 'SectionVariable: section | SharedVariable: dashboard');

      await tabs.select('Other tab');
      await expectPanelToShowContent(
        panels,
        'Outside output',
        'SectionVariable: $SectionVariable | SharedVariable: dashboard'
      );
      await expect(sectionControlLabel, `"Other tab" hides the "${sectionVariable.label}" control`).toBeHidden();
    });
  }
);

/**
 * Clicks a markdown panel, then asserts its rendered content is exactly `content`
 * @param panelTitle the title of a markdown text panel
 */
async function expectPanelToShowContent(panels: Panels, panelTitle: string, content: string) {
  await test.step(`Check panel "${panelTitle}" shows "${content}"`, async () => {
    const body = panels.getBody(panelTitle);
    // We click the panel first because a textbox variable only applies its value once its sidebar input loses focus.
    await body.click();
    await expect(body.locator('.markdown-html')).toHaveText(content);
  });
}
