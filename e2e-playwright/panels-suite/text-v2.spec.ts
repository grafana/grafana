import type { Locator } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import { test, expect } from '@grafana/plugin-e2e';

function renderedContent(container: Locator) {
  return container.frameLocator('iframe[title="Text panel content"]').locator('body');
}

// Same dashboard as text.spec.ts — v2 reads the identical panel options, so the
// two suites cover both implementations of the `text` panel from one fixture.
const DASHBOARD_UID = 'WZ7AhQiVz';

// Panel ids from devenv/dev-dashboards/panel-text/text-options.json.
const MARKDOWN_PANEL = '4';
const HTML_PANEL = '6';
const CODE_PANEL = '5';

// Rendering per row needs query data, which text-options.json has none of.
const DATA_DASHBOARD_UID = 'adssfc8';
const EVERY_ROW_PANEL = '6';
const HANDLEBARS_PANEL = '5';
const MERMAID_PANEL = '7';

const REDUCER_MACROS_DASHBOARD_UID = 'text-reducer-macros';
const LAST_VALUES_PANEL = '2';

const SUGGESTIONS_DASHBOARD_UID = 'text-suggestions';
const VALUE_PER_CATEGORY_PANEL = '8';
const LABELS_ONLY_PANEL = '15';
const MISSING_VALUES_PANEL = '18';

const TESTDATA = { type: 'grafana-testdata-datasource', uid: 'PD8C576611E62080A' };

const FMT_TEMPLATE =
  '{{#each data}}<p class="fmt-row">{{service}}: {{fmt.cpu}}{{#if (eq fmt.status "Down")}} <b>{{fmt.status}}</b>{{/if}} <i>{{#each fmt}}{{@key}} {{/each}}</i></p>{{/each}}';

const DISPLAY_TEMPLATE =
  '{{#each data}}<p class="fmt-row">{{service}}: {{display "cpu"}}{{#if (eq (display "status") "Down")}} <b>{{display "status"}}</b>{{/if}} <i>{{#each fmt}}{{@key}} {{/each}}</i></p>{{/each}}';

const fmtDashboard = (uid: string) => ({
  uid,
  title: `Text fmt migration ${uid}`,
  schemaVersion: 41,
  panels: [
    {
      id: 1,
      type: 'text',
      title: 'Formatted values',
      gridPos: { h: 10, w: 24, x: 0, y: 0 },
      datasource: TESTDATA,
      targets: [
        {
          refId: 'A',
          datasource: TESTDATA,
          scenarioId: 'csv_content',
          csvContent: 'service,cpu,status\ncheckout,0.942,down\nsearch,0.12,ok',
        },
      ],
      fieldConfig: {
        defaults: {},
        overrides: [
          {
            matcher: { id: 'byName', options: 'cpu' },
            properties: [
              { id: 'unit', value: 'percentunit' },
              { id: 'decimals', value: 1 },
            ],
          },
          {
            matcher: { id: 'byName', options: 'status' },
            properties: [
              {
                id: 'mappings',
                value: [
                  { type: 'value', options: { down: { text: 'Down', index: 0 }, ok: { text: 'Healthy', index: 1 } } },
                ],
              },
            ],
          },
        ],
      },
      options: { mode: 'html', renderMode: 'once', content: FMT_TEMPLATE },
    },
  ],
});

test.use({ openFeature: { flags: { 'grafana.newTextPanel': true, 'text.newFeatures': true } } });

test.describe('Panels test: Text v2', { tag: ['@panels'] }, () => {
  test('renders all panels on dashboard without errors', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });

    const panelTitles = [
      'Markdown (with variables)',
      'HTML (with variables)',
      'JSON (with variables)',
      'Markdown (code w/ with variables)',
    ];
    for (const title of panelTitles) {
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(title))).toBeVisible();
    }

    // The v2-only test ids are what prove the flag actually swapped the implementation:
    // v1 renders "TextPanel-converted-content" instead.
    await expect(page.getByTestId('TextNGPanel-converted-content')).toHaveCount(2);
    await expect(page.getByTestId('TextNGPanel-code')).toHaveCount(2);
    await expect(page.getByTestId('TextPanel-converted-content')).toHaveCount(0);

    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo, 'no errors in any panel').toBeHidden();
  });

  test('markdown mode renders and interpolates variables', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: MARKDOWN_PANEL }),
    });

    // In edit mode v2 replaces the panel body with the inline editor, which opens on Split.
    const preview = page.getByTestId('TextNGEditor-preview');
    await expect(preview).toBeVisible();
    const content = renderedContent(preview);
    await expect(content.locator('h2').first()).toBeVisible();
    await expect(content.locator('h3').first()).toBeVisible();
    await expect(content.locator('hr')).toBeVisible();
    await expect(content).toContainText('text = temp');
  });

  test('html mode renders content correctly', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: HTML_PANEL }),
    });

    const preview = page.getByTestId('TextNGEditor-preview');
    await expect(preview).toBeVisible();
    await expect(renderedContent(preview).locator('h3').first()).toHaveText('Data center');
    await expect(renderedContent(preview).locator('h3')).toHaveCount(4);
  });

  test('code mode renders a read-only CodeMirror view', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: CODE_PANEL }),
    });

    const preview = page.getByTestId('TextNGEditor-preview');
    await expect(preview).toBeVisible();

    // v2 swapped Monaco for CodeMirror; v1's equivalent test asserts `.monaco-editor`.
    const codeMirror = preview.locator('.cm-editor');
    await expect(codeMirror).toBeVisible();
    await expect(page.locator('.monaco-editor')).toHaveCount(0);
  });

  test('inline editor switches between preview, split and write views', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: MARKDOWN_PANEL }),
    });

    const editor = page.getByTestId('TextNGEditor');
    await expect(editor).toBeVisible();

    const preview = page.getByTestId('TextNGEditor-preview');
    const writableEditor = editor.locator('.cm-editor');

    // Split is the default view: editable surface and rendered output together.
    await expect(page.getByRole('radio', { name: 'Split' })).toBeChecked();
    await expect(writableEditor).toBeVisible();
    await expect(preview).toBeVisible();

    await page.getByRole('radio', { name: 'Write' }).click();
    await expect(writableEditor).toBeVisible();
    await expect(preview).toHaveCount(0);

    await page.getByRole('radio', { name: 'Preview' }).click();
    await expect(preview).toBeVisible();
    await expect(writableEditor).toHaveCount(0);

    await page.getByRole('radio', { name: 'Split' }).click();
    await expect(writableEditor).toBeVisible();
    await expect(preview).toBeVisible();
  });

  test('can switch between modes in panel editor', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: MARKDOWN_PANEL }),
    });

    const preview = page.getByTestId('TextNGEditor-preview');
    await expect(preview).toBeVisible();

    // Mode lives in the editor toolbar, not the options pane.
    const modePicker = page.getByRole('button', { name: /^Text mode/ });

    await modePicker.click();
    await page.getByRole('menuitemradio', { name: 'HTML' }).click();
    await expect(preview).toBeVisible();

    // Code mode is picked through its language submenu.
    await modePicker.click();
    await page.getByRole('menuitem', { name: 'Code' }).hover();
    await page.getByRole('menuitemradio', { name: 'JSON' }).click();
    await expect(preview.locator('.cm-editor')).toBeVisible();

    await modePicker.click();
    await page.getByRole('menuitemradio', { name: 'Markdown' }).click();
    await expect(preview).toBeVisible();
  });

  test.describe('render template', () => {
    test('renders the content once per data row', async ({ gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({ uid: DATA_DASHBOARD_UID });

      const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content, {
        root: dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Render mode: Per row')),
      });

      // One card per row of the panel's csv_content query.
      const content = renderedContent(panel);
      await expect(content.locator('.user-card')).toHaveCount(5);
      await expect(content).toContainText('Wei');
      await expect(content).toContainText('editor');
      await expect(content).toContainText('w.zhang@example.com');
    });

    test('switches back to a single render from the options pane', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: DATA_DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: EVERY_ROW_PANEL }),
      });

      const preview = page.getByTestId('TextNGEditor-preview');
      const content = renderedContent(preview);
      await expect(content.locator('.user-card')).toHaveCount(5);

      // Unlike Mode, Render mode lives in the options pane, not the toolbar.
      const renderMode = dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.OptionsPane.fieldLabel('Data Render mode')
      );
      await renderMode.getByRole('radio', { name: 'Once' }).click();

      // A single render cannot resolve per-row fields, so the macro stays literal.
      await expect(content.locator('.user-card')).toHaveCount(1);
      await expect(content).toContainText('${__data.fields.Id}');
    });

    test('colors each row from its own threshold', async ({ gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({ uid: DATA_DASHBOARD_UID });

      const header = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Panel.title('Threshold colors: fleet health')
      );
      // Dashboards only render panels once they are scrolled into view.
      await header.scrollIntoViewIfNeeded();

      const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content, { root: header });

      // Asserted before reading styles: evaluateAll does not wait for the render.
      const content = renderedContent(panel);
      const cpu = content.locator('.fleet-card__cpu');
      await expect(cpu).toHaveCount(5);

      const readColors = (locator: typeof cpu) =>
        locator.evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).color));

      // CPU 94, 71, 38, 83, 17 against steps at 70 and 90: red, yellow, green, yellow, green.
      const cpuColors = await readColors(cpu);
      expect(new Set(cpuColors).size).toBe(3);
      expect(cpuColors[1]).toBe(cpuColors[3]);
      expect(cpuColors[2]).toBe(cpuColors[4]);
      expect(cpuColors[0]).not.toBe(cpuColors[1]);

      // Availability's inverted override makes 99.9% green; the defaults would make it red.
      const availabilityColors = await readColors(content.locator('.fleet-card__availability'));
      expect(availabilityColors[1]).toBe(cpuColors[2]);
    });

    test('turns mapped numeric codes into a readable digest', async ({ gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({ uid: DATA_DASHBOARD_UID });

      const header = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Panel.title('Value mappings: on-call digest')
      );
      await header.scrollIntoViewIfNeeded();

      const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content, { root: header });
      const content = renderedContent(panel);
      const severity = content.locator('.digest__severity');

      await expect(severity).toHaveText(['🔴 page on-call', '🟠 degraded', '🟢 stable', '🟡 watch', '🟢 stable']);

      await expect(content.locator('.digest__code')).toHaveText([
        'server error',
        'client error',
        'OK',
        'server error',
        'OK',
      ]);

      await expect(content.locator('.digest__deploy')).toHaveText([
        'moments ago',
        'within the hour',
        'today',
        'over a day ago',
        'never',
      ]);

      await expect(content).toContainText('server error (503)');

      // Every color here comes from the mapping that matched, not from a threshold.
      // Asserted after toHaveText, which waits for the render that evaluateAll would not.
      const severityColors = await severity.evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).color));
      expect(new Set(severityColors).size).toBe(4);
      expect(severityColors[2]).toBe(severityColors[4]);
    });
  });

  test.describe('handlebars', () => {
    test('evaluates expressions against the query data', async ({ gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({ uid: DATA_DASHBOARD_UID });

      const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content, {
        root: dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Handlebars support')),
      });

      // Below the fold, so the panel doesn't query until it scrolls into view.
      await panel.scrollIntoViewIfNeeded();

      // One row per user of the panel's csv_content query.
      const content = renderedContent(panel);
      await expect(content.locator('tbody tr')).toHaveCount(5);
      await expect(content).toContainText('John Smith');

      // {{#unless}} filters the list down to the two users who are not active.
      await expect(content.locator('li')).toHaveCount(2);
      await expect(content.locator('li')).toContainText(['Jessica Johnson', 'Priya Raman']);
    });

    test('evaluates expressions in the edit preview', async ({ gotoDashboardPage, page }) => {
      await gotoDashboardPage({
        uid: DATA_DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: HANDLEBARS_PANEL }),
      });

      const preview = page.getByTestId('TextNGEditor-preview');
      await expect(renderedContent(preview)).toContainText('John Smith');
      await expect(renderedContent(preview)).not.toContainText('{{#each data}}');
    });

    test('reads mapped text, units and colors through the display helper', async ({ gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({ uid: DATA_DASHBOARD_UID });

      const header = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Panel.title('Handlebars display values: service health')
      );
      await header.scrollIntoViewIfNeeded();

      const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content, { root: header });
      const content = renderedContent(panel);
      const status = content.locator('.health__status');
      const cpu = content.locator('.health__cpu');
      const latency = content.locator('.health__latency');

      await expect(status).toHaveText(['Down', 'Degraded', 'Healthy', 'Degraded', 'No report']);
      await expect(cpu).toHaveText(['94.2%', '71.0%', '38.0%', '83.4%', '17.0%']);
      await expect(latency).toHaveText(['1.25 s', '183 ms', '12 ms', '640 ms', '3 ms']);
      await expect(content.locator('.health__errors')).toHaveText([
        '4.31% errors',
        '0.42% errors',
        '0.00% errors',
        '1.20% errors',
        'n/a errors',
      ]);

      const readColors = (locator: Locator) =>
        locator.evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).color));

      const statusColors = await readColors(status);
      const [down, degraded, healthy] = statusColors;
      expect(new Set(statusColors).size).toBe(4);
      expect(statusColors[3]).toBe(degraded);
      expect(await readColors(cpu)).toEqual([down, degraded, healthy, degraded, healthy]);
      expect(await readColors(latency.locator('b'))).toEqual([down, healthy, healthy, degraded, healthy]);
    });

    test('completes the display helper from the editor suggestions', async ({ gotoDashboardPage, page }) => {
      await gotoDashboardPage({
        uid: DATA_DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: EVERY_ROW_PANEL }),
      });

      const preview = page.getByTestId('TextNGEditor-preview');
      await expect(renderedContent(preview).locator('.user-card')).toHaveCount(5);

      const editor = page.getByRole('textbox', { name: 'Text content' });
      const suggestion = (name: string) =>
        page.getByRole('listbox', { name: 'Completions' }).getByRole('option', { name });

      await editor.click();
      await page.keyboard.press('ControlOrMeta+End');
      await editor.pressSequentially('<b class="completed">{{dis');
      await suggestion('display').click();
      await editor.pressSequentially(' "ro');
      await suggestion('role').click();
      await page.keyboard.press('ArrowRight');
      await editor.pressSequentially(' "te');
      await suggestion('text').click();
      await page.keyboard.press('ArrowRight');
      await editor.pressSequentially('}}');

      await expect(renderedContent(preview).locator('.completed')).toHaveText([
        'admin',
        'analyst',
        'editor',
        'viewer',
        'admin',
      ]);
    });
  });

  test.describe('mermaid', () => {
    test('renders diagrams in the panel', async ({ gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({ uid: DATA_DASHBOARD_UID });

      const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content, {
        root: dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Mermaid diagrams')),
      });
      await panel.scrollIntoViewIfNeeded();

      // The flowchart and the sequence diagram render; the third fence is invalid on purpose.
      const content = renderedContent(panel);
      await expect(content.locator('.mermaid-diagram svg')).toHaveCount(2);
      await expect(content.locator('.mermaid-diagram-error')).toHaveCount(1);

      // htmlLabels is off, so label text has to survive as SVG text.
      await expect(content.locator('.mermaid-diagram svg').first()).toContainText('Page on-call');
    });

    test('renders diagrams in the edit preview', async ({ gotoDashboardPage, page }) => {
      await gotoDashboardPage({
        uid: DATA_DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: MERMAID_PANEL }),
      });

      const preview = page.getByTestId('TextNGEditor-preview');
      await expect(renderedContent(preview).locator('.mermaid-diagram svg')).toHaveCount(2);
    });
  });

  test.describe('visualization suggestions', () => {
    test('applies a summary that stays bound to the query', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: REDUCER_MACROS_DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: LAST_VALUES_PANEL }),
      });

      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleVizPicker).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Suggestions')).click();

      const summary = dashboardPage.getByGrafanaSelector(
        selectors.components.VisualizationPreview.card('Text - summary')
      );
      const statistics = dashboardPage.getByGrafanaSelector(
        selectors.components.VisualizationPreview.card('Text - statistics')
      );

      await expect(statistics).toBeVisible();

      await summary.click();

      await expect(renderedContent(page.getByTestId('TextNGEditor-preview')).locator('li')).toHaveText([
        'CPU: 75.0%',
        'Memory usage: 120 B',
      ]);
      await expect(page.getByTestId('TextNGEditor').locator('.cm-content')).toContainText(
        '${__data.fields.CPU:reduce:lastNotNull}'
      );
    });

    test('applies a list with one item per row', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: SUGGESTIONS_DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: VALUE_PER_CATEGORY_PANEL }),
      });

      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleVizPicker).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Suggestions')).click();

      const list = dashboardPage.getByGrafanaSelector(selectors.components.VisualizationPreview.card('Text - list'));

      await list.click();

      await expect(renderedContent(page.getByTestId('TextNGEditor-preview')).locator('li')).toHaveText([
        'API: 99.9',
        'Worker: 97.5',
        'Web: 100',
      ]);
      await expect(page.getByTestId('TextNGEditor').locator('.cm-content')).toContainText(
        '<strong>${__data.fields.Service}</strong>: {{/unless}}<span>${__data.fields.Availability}</span>'
      );
    });

    test('applies a list that leaves out what each row has no value for', async ({
      gotoDashboardPage,
      selectors,
      page,
    }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: SUGGESTIONS_DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: MISSING_VALUES_PANEL }),
      });

      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleVizPicker).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Suggestions')).click();

      const list = dashboardPage.getByGrafanaSelector(selectors.components.VisualizationPreview.card('Text - list'));
      const items = ['alpha: color red, value 2', 'bravo: value 9', 'color orange, value 6', 'delta'];

      await list.click();

      await expect(renderedContent(page.getByTestId('TextNGEditor-preview')).locator('li')).toHaveText(items);
    });

    test('offers nothing for series told apart only by labels', async ({ gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: SUGGESTIONS_DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: LABELS_ONLY_PANEL }),
      });

      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleVizPicker).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Suggestions')).click();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.VisualizationPreview.card('Table'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.VisualizationPreview.card('Text - summary'))
      ).toHaveCount(0);
    });
  });

  test.describe('fmt migration', () => {
    let uid: string;

    test.beforeEach(async ({ request }) => {
      uid = randomUUID();
      const response = await request.post('/api/dashboards/db', { data: { dashboard: fmtDashboard(uid) } });
      expect(response.ok()).toBeTruthy();
    });

    test.afterEach(async ({ request }) => {
      await request.delete(`/api/dashboards/uid/${uid}`);
    });

    test('warns on the dashboard that the panel reads fmt, and leaves it to the editor notice in panel edit', async ({
      gotoDashboardPage,
      selectors,
      page,
    }) => {
      const dashboardPage = await gotoDashboardPage({ uid });
      const header = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Formatted values'));

      await header.getByTestId(selectors.components.Panels.Panel.status('warning')).click();
      await expect(page.getByTestId('toggletip-content')).toContainText(
        'This panel reads fmt, which is deprecated. Edit the panel to convert it to the display helper.'
      );
      await page.keyboard.press('Escape');

      await dashboardPage.gotoPanelEditPage('1');
      await expect(page.getByRole('status', { name: 'fmt is deprecated' })).toBeVisible();
      await expect(page.getByTestId(selectors.components.Panels.Panel.status('warning'))).toHaveCount(0);
    });

    test('converts fmt reads to the display helper, renders the same, and keeps them after a save', async ({
      gotoDashboardPage,
      request,
      selectors,
      page,
    }) => {
      const rows = ['checkout: 94.2% Down service cpu status', 'search: 12.0% service cpu status'];
      const dashboardPage = await gotoDashboardPage({ uid });
      const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content, {
        root: dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Formatted values')),
      });

      await expect(renderedContent(panel).locator('p.fmt-row')).toHaveText(rows);

      const editor = await dashboardPage.gotoPanelEditPage('1');
      const notice = page.getByRole('status', { name: 'fmt is deprecated' });
      await expect(notice).toContainText('3 of 4 expressions can be converted to the display helper.');

      await notice.getByRole('button', { name: 'Convert to display' }).click();
      const dialog = page.getByRole('dialog', { name: 'Convert fmt to display' });
      await expect(dialog).toContainText(
        'Converts 3 expressions. The panel renders the same for the current query results.'
      );
      await expect(dialog.getByRole('list', { name: 'Changes' }).getByRole('listitem')).toHaveText([
        'Line 1fmt.cpu→display "cpu"',
        'Line 1fmt.status→(display "status")',
        'Line 1fmt.status→display "status"',
      ]);
      await expect(dialog.getByRole('list', { name: 'Unchanged expressions' })).toContainText('Reads fmt as a whole.');
      await dialog.getByRole('button', { name: 'Convert' }).click();

      await expect(dialog).toBeHidden();
      await expect(page.getByTestId('TextNGEditor').locator('.cm-content')).toHaveText(DISPLAY_TEMPLATE);
      await expect(notice).toContainText('0 of 1 expression can be converted to the display helper.');
      await expect(renderedContent(page.getByTestId('TextNGEditor-preview')).locator('p.fmt-row')).toHaveText(rows);

      await editor.backToDashboard();
      const save = dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.saveButton);
      await expect(save).toHaveAttribute('data-testactive');
      await save.click();
      const confirm = dashboardPage.getByGrafanaSelector(selectors.components.Drawer.DashboardSaveDrawer.saveButton);
      await confirm.click();
      await expect(confirm).toBeHidden();

      const saved = await (await request.get(`/api/dashboards/uid/${uid}`)).json();
      expect(saved.dashboard.panels[0].options.content).toBe(DISPLAY_TEMPLATE);

      await page.reload();
      await expect(renderedContent(panel).locator('p.fmt-row')).toHaveText(rows);
    });
  });
});
