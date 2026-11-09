import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  type DashboardReviewNode,
  type NamedElement,
  type PanelReviewNode,
  type ReviewSummary,
  type SectionReviewNode,
} from '../types';

import { ReviewTab } from './ReviewTab';
import { type ReviewSummaryState } from './useReviewSummary';

function named(kind: NamedElement['kind'], name: string): NamedElement {
  return { kind, name };
}

/** The header's own element: named without an icon, since the header starts with it. */
function own(kind: NamedElement['kind'], name: string): NamedElement {
  return { kind, name, self: true };
}

function buildDashboardNode(): DashboardReviewNode {
  return {
    kind: 'dashboard',
    id: 'dashboard',
    label: ['Dashboard'],
    summary: 'properties',
    claims: [],
    categories: [
      {
        category: 'properties',
        label: 'Properties',
        changes: [{ kind: 'changed', text: 'Title: Old board → New board', claims: ['title'] }],
      },
    ],
  };
}

function buildChangedPanel(): PanelReviewNode {
  return {
    kind: 'panel',
    id: 'panel-1',
    label: [own('panel', '"CPU usage"')],
    summary: 'data, field config',
    claims: [],
    categories: [
      {
        category: 'data',
        label: 'Data',
        changes: [
          {
            kind: 'changed',
            text: 'Query A: changed',
            details: { before: () => 'rate(cpu[5m])', after: () => 'rate(cpu[1m])' },
            claims: ['elements/panel-1/spec/data/spec/queries/0/spec/query/spec/expr'],
          },
        ],
      },
      {
        category: 'fieldConfig',
        label: 'Field config',
        changes: [
          {
            kind: 'changed',
            text: 'Unit: none → percent',
            claims: ['elements/panel-1/spec/vizConfig/spec/fieldConfig'],
          },
        ],
      },
    ],
  };
}

function buildAddedPanel(): PanelReviewNode {
  return {
    kind: 'panel',
    id: 'panel-2',
    label: ['Added ', own('panel', '"Errors"')],
    status: 'added',
    summary: '',
    categories: [],
    claims: ['elements/panel-2'],
  };
}

function buildRowWithPanels(): SectionReviewNode {
  return {
    kind: 'section',
    sectionKind: 'row',
    id: 'row-api',
    label: [own('row', '"API"')],
    summary: '',
    categories: [],
    children: [buildChangedPanel(), buildAddedPanel()],
    claims: [],
  };
}

function buildRemovedTab(): SectionReviewNode {
  return {
    kind: 'section',
    sectionKind: 'tab',
    id: 'tab-legacy',
    label: ['Removed ', own('tab', '"Legacy"')],
    status: 'removed',
    summary: '',
    categories: [],
    children: [],
    removedContents: [[named('panel', '"Old latency"')], [named('panel', '(unnamed)'), ' at position 2']],
    claims: ['layout/spec/tabs/1'],
  };
}

function buildSummary(overrides: Partial<ReviewSummary> = {}): ReviewSummary {
  return {
    mode: 'save',
    baselineKind: 'saved',
    overview: {
      line: 'Changes to the dashboard, 2 sections, and 2 panels',
      counts: { added: 1, changed: 3, removed: 1, moved: 0 },
    },
    tree: [buildDashboardNode(), buildRowWithPanels(), buildRemovedTab()],
    metadata: [{ kind: 'changed', text: 'Folder: General → Operations', claims: [] }],
    systemDefaults: [
      {
        label: [named('panel', '"CPU usage"')],
        changes: [
          { kind: 'added', text: 'Plugin version: 12.1.0', claims: ['elements/panel-1/spec/vizConfig/version'] },
          { kind: 'added', text: 'Legend › Mode: list', claims: ['elements/panel-1/spec/vizConfig/spec/options'] },
        ],
      },
    ],
    bookkeeping: [],
    collapsePanelsByDefault: false,
    ...overrides,
  };
}

function renderReviewTab(state: ReviewSummaryState) {
  const user = userEvent.setup();
  const onBackToDetails = jest.fn();
  const onShowChanges = jest.fn();
  const renderResult = render(
    <ReviewTab state={state} onBackToDetails={onBackToDetails} onShowChanges={onShowChanges} />
  );

  const elements = {
    toggle: (name: string | RegExp) => screen.getByRole('button', { name }),
  };

  return {
    ...renderResult,
    user,
    elements,
    onBackToDetails,
    onShowChanges,
    actions: {
      click: (name: string | RegExp) => user.click(elements.toggle(name)),
    },
  };
}

function controlledBy(toggle: HTMLElement): HTMLElement {
  const content = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
  if (!content) {
    throw new Error('The toggle controls no rendered content');
  }
  return content;
}

function ready(summary: ReviewSummary): ReviewSummaryState {
  return { status: 'ready', summary };
}

describe('<ReviewTab />', () => {
  describe('overview', () => {
    test('when the summary is ready, it shows the summary line and only the non-zero change counts', () => {
      renderReviewTab(ready(buildSummary()));

      expect(screen.getByText('Changes to the dashboard, 2 sections, and 2 panels')).toBeInTheDocument();
      expect(screen.getByText('1 added')).toBeInTheDocument();
      expect(screen.getByText('3 changed')).toBeInTheDocument();
      expect(screen.getByText('1 removed')).toBeInTheDocument();
      expect(screen.queryByText('0 moved')).not.toBeInTheDocument();
    });

    test('when there are additions and removals, their counts carry the same + and − as the items below', () => {
      renderReviewTab(ready(buildSummary()));

      const added = screen.getByText('1 added').closest('li');
      const removed = screen.getByText('1 removed').closest('li');
      const changed = screen.getByText('3 changed').closest('li');
      expect(added && within(added).getByTestId('icon-plus')).toBeInTheDocument();
      expect(removed && within(removed).getByTestId('icon-minus')).toBeInTheDocument();
      expect(changed && within(changed).queryByTestId('icon-plus')).not.toBeInTheDocument();
    });

    test('when the dashboard is new, it opens with the creation intro', () => {
      renderReviewTab(ready(buildSummary({ mode: 'new' })));

      expect(screen.getByText('This creates a new dashboard with:')).toBeInTheDocument();
    });

    test('when saving a copy, the intro names the source dashboard as is', () => {
      renderReviewTab(ready(buildSummary({ mode: 'saveAsCopy', sourceTitle: "R&D's board" })));

      expect(
        screen.getByText(
          'This saves a copy of "R&D\'s board". The original dashboard isn\'t changed. Differences from the original:'
        )
      ).toBeInTheDocument();
    });

    test('when the baseline is a pending change, it says what the save is compared with', () => {
      renderReviewTab(ready(buildSummary({ baselineKind: 'pendingChanges' })));

      expect(screen.getByText('Compared with the pending changes, not the saved dashboard.')).toBeInTheDocument();
    });

    test('when the baseline is the saved dashboard, no comparison note is shown', () => {
      renderReviewTab(ready(buildSummary()));

      expect(screen.getByText('Changes to the dashboard, 2 sections, and 2 panels')).toBeInTheDocument();
      expect(screen.queryByText('Compared with the pending changes, not the saved dashboard.')).not.toBeInTheDocument();
    });
  });

  describe('change tree', () => {
    test('when panels are not collapsed by default, every node starts expanded with its changes', () => {
      const { elements } = renderReviewTab(ready(buildSummary()));

      expect(elements.toggle(/^Dashboard/)).toHaveAttribute('aria-expanded', 'true');
      expect(elements.toggle(/^Row "API"/)).toHaveAttribute('aria-expanded', 'true');
      expect(elements.toggle(/^Panel "CPU usage"/)).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('Title: Old board → New board')).toBeInTheDocument();
      expect(screen.getByText('Unit: none → percent')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Field config' })).toBeInTheDocument();
    });

    test('when panels collapse by default, panel nodes start collapsed with their summary and sections stay expanded', () => {
      const { elements } = renderReviewTab(ready(buildSummary({ collapsePanelsByDefault: true })));

      expect(elements.toggle(/^Panel "CPU usage"/)).toHaveAttribute('aria-expanded', 'false');
      expect(elements.toggle(/^Panel "CPU usage"/)).toHaveTextContent('data, field config');
      expect(screen.queryByText('Unit: none → percent')).not.toBeInTheDocument();
      expect(elements.toggle(/^Row "API"/)).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('Title: Old board → New board')).toBeInTheDocument();
    });

    test('when a node is collapsed, its changes are hidden and its header shows the summary', async () => {
      const { elements, actions } = renderReviewTab(ready(buildSummary()));
      expect(elements.toggle(/^Panel "CPU usage"/)).not.toHaveTextContent('data, field config');

      await actions.click(/^Panel "CPU usage"/);

      expect(elements.toggle(/^Panel "CPU usage"/)).toHaveAttribute('aria-expanded', 'false');
      expect(elements.toggle(/^Panel "CPU usage"/)).toHaveTextContent('data, field config');
      expect(screen.queryByText('Unit: none → percent')).not.toBeInTheDocument();
    });

    describe('names in headers', () => {
      const addedRow: SectionReviewNode = {
        kind: 'section',
        sectionKind: 'row',
        id: 'row-new',
        label: ['added ', own('row', '"new row"'), ' under ', named('tab', '"tab 1"')],
        status: 'added',
        summary: '',
        categories: [],
        children: [],
        claims: ['layout/spec/tabs/0/spec/layout/spec/rows/1'],
      };

      test('when a header names another element, its icon is shown and named by its kind word', () => {
        renderReviewTab(ready(buildSummary({ tree: [addedRow] })));

        const header = screen.getByRole('heading', { name: 'Added Row "new row" under Tab "tab 1"' });
        const tabIcon = within(header).getByRole('img', { name: 'Tab' });
        expect(tabIcon).toHaveAttribute('data-testid', 'icon-layers');
        expect(within(header).getByText('"tab 1"')).toBeInTheDocument();
      });

      test('when a header names its own element, only the leading icon shows it', () => {
        renderReviewTab(ready(buildSummary({ tree: [addedRow] })));

        const header = screen.getByRole('heading', { name: 'Added Row "new row" under Tab "tab 1"' });
        expect(within(header).getAllByTestId('icon-list-ul')).toHaveLength(1);
        expect(within(header).queryByRole('img', { name: 'Row' })).not.toBeInTheDocument();
      });

      test('when a label starts with a lowercase string, only that first string is capitalized', () => {
        // A later string that starts with a letter shows the rule: it stays as the engine wrote it
        const row: SectionReviewNode = {
          ...addedRow,
          label: ['added ', own('row', '"new row"'), 'under ', named('tab', '"tab 1"')],
        };
        renderReviewTab(ready(buildSummary({ tree: [row] })));

        const header = screen.getByRole('heading', { name: /^Added Row "new row"/ });
        expect(header).toHaveTextContent('Added Row "new row"under "tab 1"');
      });

      test('when a System defaults owner and a removed item are rich text, they show icons and a capital', async () => {
        const { elements, actions } = renderReviewTab(
          ready(
            buildSummary({
              systemDefaults: [
                {
                  label: [named('panel', '"CPU"'), ' in ', named('tab', '"A"')],
                  changes: [{ kind: 'added', text: 'Plugin version: 12.1.0', claims: [] }],
                },
              ],
            })
          )
        );

        await actions.click('System defaults (1)');

        const owner = within(controlledBy(elements.toggle('System defaults (1)'))).getByRole('heading', {
          name: 'Panel "CPU" in Tab "A"',
        });
        expect(within(owner).getByRole('img', { name: 'Panel' })).toBeInTheDocument();
        const removedItem = screen.getByText('"Old latency"').closest('li');
        expect(removedItem).toHaveTextContent('"Old latency"');
        expect(within(removedItem!).getByRole('img', { name: 'Panel' })).toBeInTheDocument();
      });
    });

    test('when a node was added and has nothing to reveal, its header is marked Added and has no toggle', () => {
      renderReviewTab(ready(buildSummary()));

      // The label says "Added", so the + marker is silent rather than saying it twice
      const header = screen.getByRole('heading', { name: 'Added Panel "Errors"' });
      expect(within(header).getByTestId('icon-plus')).toBeInTheDocument();
      expect(within(header).queryByRole('img', { name: 'Added' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Panel "Errors"/ })).not.toBeInTheDocument();
    });

    test('when a node was moved, its header reads the label followed by where it moved', () => {
      const moved: PanelReviewNode = {
        ...buildAddedPanel(),
        id: 'panel-3',
        label: [own('panel', '"New panel"')],
        status: 'moved',
        statusText: ['moved after ', named('panel', '"Latency"')],
      };
      renderReviewTab(ready(buildSummary({ tree: [moved] })));

      const header = screen.getByRole('heading', { name: 'Panel "New panel" moved after Panel "Latency"' });
      expect(within(header).getByRole('img', { name: 'Panel' })).toBeInTheDocument();
      expect(within(header).queryByTestId('icon-plus')).not.toBeInTheDocument();
      expect(within(header).queryByTestId('icon-minus')).not.toBeInTheDocument();
    });

    test('when a node was updated, its header reads the label followed by how much changed', () => {
      const updated: PanelReviewNode = {
        ...buildChangedPanel(),
        id: 'panel-errors',
        label: [own('panel', '"Errors"')],
        statusText: ['was updated (2 changes)'],
      };
      const { elements } = renderReviewTab(
        ready(buildSummary({ tree: [{ ...buildRowWithPanels(), children: [updated] }] }))
      );

      expect(elements.toggle('Panel "Errors" was updated (2 changes)')).toHaveAttribute('aria-expanded', 'true');
      expect(elements.toggle('Row "API"')).toHaveAttribute('aria-expanded', 'true');
    });

    test('when an element line is added or removed, it is its name marked with + or − and its icon if its kind has one', () => {
      const dashboard = buildDashboardNode();
      dashboard.categories = [
        {
          category: 'controls',
          label: 'Controls',
          changes: [
            { kind: 'added', subject: 'variable', text: 'Variable "env"', claims: ['variables/1'] },
            { kind: 'removed', subject: 'link', text: 'Link "Runbook"', claims: ['links/0'] },
            { kind: 'changed', text: 'Time picker: hidden', claims: ['timeSettings/hideTimepicker'] },
            { kind: 'added', subject: 'tag', text: 'Tag "prod"', claims: ['tags/0'] },
          ],
        },
      ];
      renderReviewTab(ready(buildSummary({ tree: [dashboard] })));

      const [added, removed, field, tag] = within(screen.getByRole('heading', { name: 'Controls' }).parentElement!)
        .getAllByRole('listitem')
        .map((item) => within(item));
      expect(added.getByRole('img', { name: 'Added' })).toContainElement(added.getByTestId('icon-plus'));
      expect(added.getByTestId('icon-gf-variable')).toBeInTheDocument();
      expect(added.getByText('Variable "env"')).toBeInTheDocument();
      expect(removed.getByRole('img', { name: 'Removed' })).toContainElement(removed.getByTestId('icon-minus'));
      expect(removed.getByTestId('icon-external-link-alt')).toBeInTheDocument();
      expect(field.getByText('Time picker: hidden')).toBeInTheDocument();
      expect(field.queryByRole('img')).not.toBeInTheDocument();
      expect(tag.getByRole('img', { name: 'Added' })).toContainElement(tag.getByTestId('icon-plus'));
      expect(tag.getByText('Tag "prod"')).toBeInTheDocument();
      expect(tag.getAllByTestId(/^icon-/).map((icon) => icon.dataset.testid)).toEqual(['icon-plus']);
    });

    test.each([
      { kind: 'dashboard', label: 'Dashboard', icon: 'icon-apps' },
      { kind: 'row', label: 'Row "API"', icon: 'icon-list-ul' },
      { kind: 'tab', label: 'Removed Tab "Legacy"', icon: 'icon-layers' },
      { kind: 'panel', label: 'Panel "CPU usage"', icon: 'icon-chart-line' },
    ])('when the tree has a $kind node, its header starts with the $icon icon', ({ label, icon }) => {
      renderReviewTab(ready(buildSummary()));

      const header = screen.getByRole('heading', { name: new RegExp(`${label}`) });
      expect(within(header).getByTestId(icon)).toBeInTheDocument();
    });

    test('when a section was removed, its header is marked Removed and lists what was removed with it', () => {
      const { elements } = renderReviewTab(ready(buildSummary()));

      expect(elements.toggle('Removed Tab "Legacy"')).toHaveAttribute('aria-expanded', 'true');
      expect(elements.toggle('Removed with it (2)')).toHaveAttribute('aria-expanded', 'true');
      const items = within(controlledBy(elements.toggle('Removed with it (2)'))).getAllByRole('listitem');
      expect(items.map((item) => item.textContent?.trim())).toEqual(['"Old latency"', '(unnamed) at position 2']);
    });

    test('when a section was removed and has contents, its − marker is the toggle in place of the chevron', () => {
      const { elements } = renderReviewTab(ready(buildSummary()));

      const toggle = elements.toggle('Removed Tab "Legacy"');
      expect(within(toggle).getByTestId('icon-minus')).toBeInTheDocument();
      expect(within(toggle).queryByTestId('icon-angle-down')).not.toBeInTheDocument();
    });

    describe('what an added element is set to', () => {
      const addedPanel: PanelReviewNode = {
        ...buildAddedPanel(),
        properties: [
          { label: 'Description', value: '"Cache hits during last week"' },
          { label: 'Queries (1)', details: () => '[\n  { "refId": "A" }\n]' },
        ],
      };

      test('when an added panel has properties, it starts collapsed and its + is the toggle', () => {
        const { elements } = renderReviewTab(ready(buildSummary({ tree: [addedPanel] })));

        const toggle = elements.toggle('Added Panel "Errors"');
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(within(toggle).getByTestId('icon-plus')).toBeInTheDocument();
        expect(screen.queryByText('"Cache hits during last week"')).not.toBeInTheDocument();
      });

      test('when its + is clicked, literal values show inline and lists and objects wait behind Show', async () => {
        const { elements, actions } = renderReviewTab(ready(buildSummary({ tree: [addedPanel] })));

        await actions.click('Added Panel "Errors"');

        const content = controlledBy(elements.toggle('Added Panel "Errors"'));
        const items = within(content).getAllByRole('listitem');
        expect(items[0]).toHaveTextContent('Description: "Cache hits during last week"');
        expect(within(items[0]).queryByRole('button')).not.toBeInTheDocument();
        expect(screen.queryByText(/"refId": "A"/)).not.toBeInTheDocument();

        await actions.click('Show');

        expect(screen.getByText(/"refId": "A"/)).toBeInTheDocument();
      });

      test('when an added list item has properties, its + is the toggle that reveals them', async () => {
        const dashboard: DashboardReviewNode = {
          ...buildDashboardNode(),
          categories: [
            {
              category: 'controls',
              label: 'Controls',
              changes: [
                {
                  kind: 'added',
                  subject: 'variable',
                  text: 'Custom variable "env"',
                  properties: [{ label: 'Query', value: '"prod,staging"' }],
                  claims: ['variables/0'],
                },
              ],
            },
          ],
        };
        const { elements, actions } = renderReviewTab(ready(buildSummary({ tree: [dashboard] })));

        const toggle = elements.toggle('Added Custom variable "env"');
        expect(toggle).toHaveAttribute('aria-expanded', 'false');

        await actions.click('Added Custom variable "env"');

        expect(within(controlledBy(toggle)).getByRole('listitem')).toHaveTextContent('Query: "prod,staging"');
      });

      test('when several fields of one element changed, one line names it and its chevron reveals the changes', async () => {
        const dashboard: DashboardReviewNode = {
          ...buildDashboardNode(),
          categories: [
            {
              category: 'controls',
              label: 'Controls',
              changes: [
                {
                  kind: 'changed',
                  subject: 'variable',
                  text: 'Query variable "number"',
                  statusText: '(2 changes)',
                  changes: [
                    { kind: 'changed', text: 'Include All option: turned off', claims: [] },
                    { kind: 'changed', text: 'Refresh: set to onDashboardLoad', claims: [] },
                  ],
                  claims: ['variables/0/spec/includeAll', 'variables/0/spec/refresh'],
                },
              ],
            },
          ],
        };
        const { elements, actions } = renderReviewTab(ready(buildSummary({ tree: [dashboard] })));

        const toggle = elements.toggle('Query variable "number" (2 changes)');
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(within(toggle).getByTestId('icon-angle-right')).toBeInTheDocument();
        expect(screen.queryByText('Include All option: turned off')).not.toBeInTheDocument();

        await actions.click('Query variable "number" (2 changes)');

        const lines = within(controlledBy(toggle)).getAllByRole('listitem');
        expect(lines.map((line) => line.textContent?.trim())).toEqual([
          'Include All option: turned off',
          'Refresh: set to onDashboardLoad',
        ]);
      });
    });

    describe('elements a layout change moved into a new section', () => {
      const newRow: SectionReviewNode = {
        kind: 'section',
        sectionKind: 'row',
        id: 'row-new',
        label: ['Added ', own('row', '"New row 1"')],
        status: 'added',
        statusText: ['(2 panels moved to it)'],
        summary: '',
        categories: [],
        children: [],
        movedIn: [
          { name: [named('panel', '"P3"')], nodeId: 'panel-3' },
          { name: [named('panel', '"P4"')], nodeId: 'panel-4' },
        ],
        claims: [],
      };

      test('when the section has nothing else to show, it starts collapsed with the count in its header', () => {
        const { elements } = renderReviewTab(ready(buildSummary({ tree: [newRow] })));

        const toggle = elements.toggle('Added Row "New row 1" (2 panels moved to it)');
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(within(toggle).getByTestId('icon-plus')).toBeInTheDocument();
        expect(within(toggle).queryByTestId('icon-angle-right')).not.toBeInTheDocument();
        expect(screen.queryByText('"P3"')).not.toBeInTheDocument();
      });

      test('when its + is clicked, it lists the moved elements with their icons and no toggles of their own', async () => {
        const { elements, actions } = renderReviewTab(ready(buildSummary({ tree: [newRow] })));

        await actions.click('Added Row "New row 1" (2 panels moved to it)');

        const content = controlledBy(elements.toggle('Added Row "New row 1" (2 panels moved to it)'));
        const items = within(content).getAllByRole('listitem');
        expect(items.map((item) => item.textContent?.trim())).toEqual(['"P3"', '"P4"']);
        expect(within(items[0]).getByRole('img', { name: 'Panel' })).toBeInTheDocument();
        expect(within(content).queryByRole('button')).not.toBeInTheDocument();
      });

      test('when a moved-in element also changed, it is listed once, as its own line in its place', () => {
        const changed = buildChangedPanel();
        const { elements } = renderReviewTab(
          ready(
            buildSummary({
              tree: [
                {
                  ...newRow,
                  movedIn: [
                    { name: [named('panel', '"P3"')], nodeId: 'panel-3' },
                    { name: [named('panel', '"CPU usage"')], nodeId: changed.id },
                  ],
                  children: [changed],
                },
              ],
            })
          )
        );

        // It has a changed child, so it starts expanded

        const items = within(
          controlledBy(elements.toggle('Added Row "New row 1" (2 panels moved to it)'))
        ).getAllByRole('listitem');
        expect(items[0]).toHaveTextContent('"P3"');
        expect(within(items[1]).getByRole('button', { name: /^Panel "CPU usage"/ })).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: /^Panel "CPU usage"/ })).toHaveLength(1);
      });

      test('when the section also has changes of its own, it starts expanded', () => {
        const { elements } = renderReviewTab(
          ready(buildSummary({ tree: [{ ...newRow, children: [buildAddedPanel()] }] }))
        );

        expect(elements.toggle('Added Row "New row 1" (2 panels moved to it)')).toHaveAttribute(
          'aria-expanded',
          'true'
        );
      });
    });

    test('when a line is added above an open value after a recompute, the value stays open on its own line', async () => {
      const { actions, rerender, onBackToDetails, onShowChanges } = renderReviewTab(ready(buildSummary()));
      await actions.click('Show');
      const panel = buildChangedPanel();
      panel.categories[0].changes.unshift({
        kind: 'added',
        text: 'Query B: added',
        details: { after: () => 'up{job="api"}' },
        claims: ['elements/panel-1/spec/data/spec/queries/1'],
      });

      rerender(
        <ReviewTab
          state={ready(buildSummary({ tree: [{ ...buildRowWithPanels(), children: [panel] }] }))}
          onBackToDetails={onBackToDetails}
          onShowChanges={onShowChanges}
        />
      );

      expect(screen.getByText('rate(cpu[5m])')).toBeInTheDocument();
      expect(screen.queryByText('up{job="api"}')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Show' })).toHaveAttribute('aria-expanded', 'false');
    });

    test('when Show is clicked on a long value, the before and after values appear inline', async () => {
      const { elements, actions } = renderReviewTab(ready(buildSummary()));
      expect(screen.queryByText('rate(cpu[5m])')).not.toBeInTheDocument();

      await actions.click('Show');

      expect(elements.toggle('Hide')).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('Before')).toBeInTheDocument();
      expect(screen.getByText('rate(cpu[5m])')).toBeInTheDocument();
      expect(screen.getByText('After')).toBeInTheDocument();
      expect(screen.getByText('rate(cpu[1m])')).toBeInTheDocument();
    });
  });

  describe('Metadata and System defaults', () => {
    test('when they have entries, they start collapsed with their count in the header', () => {
      const { elements } = renderReviewTab(ready(buildSummary()));

      expect(elements.toggle('Metadata (1)')).toHaveAttribute('aria-expanded', 'false');
      expect(elements.toggle('System defaults (2)')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText('Folder: General → Operations')).not.toBeInTheDocument();
      expect(screen.queryByText('Plugin version: 12.1.0')).not.toBeInTheDocument();
    });

    test('when System defaults is expanded, it shows the note and the defaults grouped by owner', async () => {
      const { elements, actions } = renderReviewTab(ready(buildSummary()));

      await actions.click('System defaults (2)');

      const content = within(controlledBy(elements.toggle('System defaults (2)')));
      expect(content.getByText("Values Grafana filled in automatically. You didn't edit them.")).toBeInTheDocument();
      expect(content.getByRole('heading', { name: 'Panel "CPU usage"' })).toBeInTheDocument();
      expect(content.getByText('Plugin version: 12.1.0')).toBeInTheDocument();
      expect(content.getByText('Legend › Mode: list')).toBeInTheDocument();
    });

    test('when they have no entries, they are omitted', () => {
      renderReviewTab(ready(buildSummary({ metadata: [], systemDefaults: [] })));

      expect(screen.getByText('Changes to the dashboard, 2 sections, and 2 panels')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Metadata/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^System defaults/ })).not.toBeInTheDocument();
    });
  });

  describe('Expand all and Collapse all', () => {
    test('when Collapse all is clicked, every node collapses to its summary', async () => {
      const { elements, actions } = renderReviewTab(ready(buildSummary()));

      await actions.click('Collapse all');

      expect(elements.toggle(/^Dashboard/)).toHaveAttribute('aria-expanded', 'false');
      expect(elements.toggle(/^Dashboard/)).toHaveTextContent('properties');
      expect(elements.toggle(/^Row "API"/)).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText('Title: Old board → New board')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Panel "CPU usage"/ })).not.toBeInTheDocument();
    });

    test('when Expand all is clicked, panels, Metadata and System defaults all open', async () => {
      const { elements, actions } = renderReviewTab(ready(buildSummary({ collapsePanelsByDefault: true })));

      await actions.click('Expand all');

      expect(elements.toggle(/^Panel "CPU usage"/)).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('Unit: none → percent')).toBeInTheDocument();
      expect(screen.getByText('Folder: General → Operations')).toBeInTheDocument();
      expect(screen.getByText('Plugin version: 12.1.0')).toBeInTheDocument();
    });

    test('when a node is toggled after Collapse all, only that node opens', async () => {
      const { elements, actions } = renderReviewTab(ready(buildSummary()));
      await actions.click('Collapse all');

      await actions.click(/^Dashboard/);

      expect(elements.toggle(/^Dashboard/)).toHaveAttribute('aria-expanded', 'true');
      expect(elements.toggle(/^Row "API"/)).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('states', () => {
    test('when a ready summary is being recomputed, it keeps showing it and says it is summarizing', () => {
      renderReviewTab({ status: 'ready', summary: buildSummary(), refreshing: true });

      expect(screen.getByText('Summarizing changes…')).toBeInTheDocument();
      expect(screen.getByText('Changes to the dashboard, 2 sections, and 2 panels')).toBeInTheDocument();
    });

    test('when the summary is loading, it says it is summarizing', () => {
      renderReviewTab({ status: 'loading' });

      expect(screen.getByText('Summarizing changes…')).toBeInTheDocument();
    });

    test('when nothing would be saved, it says there are no changes to save', () => {
      renderReviewTab(
        ready(
          buildSummary({
            overview: { line: '', counts: { added: 0, changed: 0, removed: 0, moved: 0 } },
            tree: [],
            metadata: [],
            systemDefaults: [],
          })
        )
      );

      expect(screen.getByText('No changes to save')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Expand all' })).not.toBeInTheDocument();
    });

    test('when only metadata and system defaults changed, it says the content is unchanged and keeps the sections', () => {
      const { elements } = renderReviewTab(
        ready(
          buildSummary({
            overview: { line: '', counts: { added: 0, changed: 1, removed: 0, moved: 0 } },
            tree: [],
          })
        )
      );

      expect(
        screen.getByText(
          'No changes to the dashboard content. Expand the sections below to see what else will be saved.'
        )
      ).toBeInTheDocument();
      expect(elements.toggle('Metadata (1)')).toBeInTheDocument();
      expect(elements.toggle('System defaults (2)')).toBeInTheDocument();
      expect(screen.queryByText('No changes to save')).not.toBeInTheDocument();
    });

    test('when the summary fails, it says so and links to the technical diff instead of showing an empty summary', async () => {
      const { user, onShowChanges } = renderReviewTab({ status: 'error' });

      expect(screen.getByText('Unable to summarize changes')).toBeInTheDocument();
      expect(screen.queryByText('No changes to save')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'See the technical diff in Changes' }));

      expect(onShowChanges).toHaveBeenCalledTimes(1);
    });

    test.each([
      { name: 'loading', state: { status: 'loading' } as const },
      { name: 'failed', state: { status: 'error' } as const },
      { name: 'ready', state: ready(buildSummary()) },
    ])('when the summary is $name, Back to details returns to Details', async ({ state }) => {
      const { user, onBackToDetails } = renderReviewTab(state);

      await user.click(screen.getByRole('button', { name: 'Back to details' }));

      expect(onBackToDetails).toHaveBeenCalledTimes(1);
    });

    test('when the summary is ready, there is no Save action', () => {
      renderReviewTab(ready(buildSummary()));

      const buttons = screen.getAllByRole('button').map((button) => button.textContent);
      expect(buttons).toContain('Back to details');
      expect(buttons.filter((text) => /save/i.test(text ?? ''))).toEqual([]);
    });
  });
});
