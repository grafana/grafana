import { type Page } from '@playwright/test';

import { test, expect, type E2ESelectorGroups } from '@grafana/plugin-e2e';

// High-signal smoke coverage for dashboard transformations under the Query Editor Next
// surface. Tests here are deliberately small and canary-focused:
//
//   1. Editor-mount smokes: click-through the picker for a representative set of
//      transformations whose `defaultOptions` shapes differ, asserting each editor
//      renders without an inline panel error. These guard against regressions in the
//      registry/editor contract exposed by lazy-loaded editors.
//
//   2. Picker applicability: for data shapes that make specific transformations
//      unapplicable, assert the card still exposes the applicability info affordance.
//      The substring match on the tooltip text is intentional because the full
//      description includes a runtime number (like the current field count);
//      matching only a stable part keeps the test focused on the applicability
//      behavior and won't break when the count changes.

test.use({
  openFeature: {
    flags: {
      queryEditorNext: true,
    },
  },
});

const DASHBOARD_UID = 'transforms-smoke';
const PANEL_MULTI_FIELD_TIME_SERIES = '1';
const PANEL_NO_TIME_FIELD = '2';
const PANEL_TWO_FIELDS = '3';
const PANEL_SINGLE_FIELD = '4';

function editPanelUrl(panelId: string) {
  return new URLSearchParams({ editPanel: panelId });
}

function addTransformationButton(page: Page) {
  return page.getByLabel('Add transformation');
}

async function openTransformationPicker(page: Page, selectors: E2ESelectorGroups) {
  await addTransformationButton(page).click();

  const searchInput = page.getByTestId(selectors.components.Transforms.searchInput);
  await expect(searchInput).toBeVisible();
  return searchInput;
}

async function pickTransformationCard(page: Page, selectors: E2ESelectorGroups, name: string) {
  const searchInput = await openTransformationPicker(page, selectors);
  // Narrow the grid down to the target card so the click can't land on an
  // adjacent tile from the virtualized grid.
  await searchInput.fill(name);

  const card = page.getByTestId(selectors.components.TransformTab.newTransform(name));
  await expect(card).toBeVisible();
  return card;
}

async function assertEditorMountsFor(page: Page, selectors: E2ESelectorGroups, name: string) {
  const card = await pickTransformationCard(page, selectors, name);
  await card.click();

  await expect(page.getByTestId(selectors.components.TransformTab.transformationEditor(name))).toBeVisible();
  await expect(page.getByTestId(selectors.components.Panels.Panel.PanelDataErrorMessage)).toBeHidden();
}

async function assertTransformationPickerDisabled(
  page: Page,
  selectors: E2ESelectorGroups,
  name: string,
  descriptionSubstring: string
) {
  const card = await pickTransformationCard(page, selectors, name);

  // TransformationCard renders the applicability info button only when the
  // transformation reports itself as not applicable for the current input data.
  // Scoping the locator inside the card's data-testid isolates the assertion
  // from other disabled cards that might appear in the picker.
  const applicabilityInfo = card.getByTestId(selectors.components.Transforms.applicabilityInfo);
  await expect(applicabilityInfo).toBeVisible();
  await expect(applicabilityInfo).toHaveAttribute('aria-label', new RegExp(descriptionSubstring));
}

// ---------------------------------------------------------------------------
// Editor-mount smokes
// ---------------------------------------------------------------------------
//
// All mount assertions run against the multi-field time-series panel, which has
// three fields including a time column — enough to satisfy every transformation's
// applicability check so the picker click lands on an enabled card.
test.describe('Query Editor Next: Transformation editor mount smoke', { tag: ['@panels', '@queryEditorNext'] }, () => {
  test.beforeEach(async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: editPanelUrl(PANEL_MULTI_FIELD_TIME_SERIES),
    });
    await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.General.content)).toBeVisible();
  });

  test('Reduce editor mounts with default options', async ({ page, selectors }) => {
    await assertEditorMountsFor(page, selectors, 'Reduce');
  });

  test('Convert field type editor mounts with default options', async ({ page, selectors }) => {
    await assertEditorMountsFor(page, selectors, 'Convert field type');
  });

  test('Group by editor mounts with default options', async ({ page, selectors }) => {
    await assertEditorMountsFor(page, selectors, 'Group by');
  });

  test('Group to nested tables editor mounts with default options', async ({ page, selectors }) => {
    await assertEditorMountsFor(page, selectors, 'Group to nested tables');
  });

  test('Format time editor mounts with default options', async ({ page, selectors }) => {
    await assertEditorMountsFor(page, selectors, 'Format time');
  });

  test('Grouping to matrix editor mounts with default options', async ({ page, selectors }) => {
    await assertEditorMountsFor(page, selectors, 'Grouping to matrix');
  });
});

// ---------------------------------------------------------------------------
// Picker applicability
// ---------------------------------------------------------------------------
//
// Each row targets a panel whose data shape makes exactly one transformation
// unapplicable. The applicability info affordance is the signal that the picker
// still recognises the unsupported input — it is intentionally not an assertion
// on click-blocking behaviour, since the card remains clickable by design.
interface ApplicabilityCase {
  panelId: string;
  transformationName: string;
  inputDescription: string;
  tooltipSubstring: string;
}

const applicabilityCases: ApplicabilityCase[] = [
  {
    panelId: PANEL_MULTI_FIELD_TIME_SERIES,
    transformationName: 'Merge series/tables',
    inputDescription: 'a single-series input',
    tooltipSubstring: 'at least 2 data series',
  },
  {
    panelId: PANEL_NO_TIME_FIELD,
    transformationName: 'Format time',
    inputDescription: 'an input without a time field',
    tooltipSubstring: 'requires a time field',
  },
  {
    panelId: PANEL_TWO_FIELDS,
    transformationName: 'Grouping to matrix',
    inputDescription: 'an input with fewer than three fields',
    tooltipSubstring: 'at least 3 fields',
  },
  {
    panelId: PANEL_SINGLE_FIELD,
    transformationName: 'Group to nested tables',
    inputDescription: 'an input with a single field',
    tooltipSubstring: 'at least 2 fields',
  },
];

test.describe(
  'Query Editor Next: Transformation picker applicability',
  { tag: ['@panels', '@queryEditorNext'] },
  () => {
    for (const { panelId, transformationName, inputDescription, tooltipSubstring } of applicabilityCases) {
      test(`${transformationName} is flagged as not applicable for ${inputDescription}`, async ({
        gotoDashboardPage,
        selectors,
        page,
      }) => {
        const dashboardPage = await gotoDashboardPage({
          uid: DASHBOARD_UID,
          queryParams: editPanelUrl(panelId),
        });
        await expect(
          dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.General.content)
        ).toBeVisible();

        await assertTransformationPickerDisabled(page, selectors, transformationName, tooltipSubstring);
      });
    }
  }
);
