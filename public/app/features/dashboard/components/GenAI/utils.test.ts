import { createDashboardModelFixture, createPanelJSONFixture } from '../../state/__fixtures__/dashboardFixtures';

import { getDashboardChanges } from './utils';

describe('getDashboardChanges', () => {
  it('should correctly split user changes and migration changes', () => {
    // Mock data for testing
    const deprecatedOptions = {
      legend: { displayMode: 'hidden', showLegend: false },
    };
    const deprecatedVersion = 37;
    const dashboard = createDashboardModelFixture({
      schemaVersion: deprecatedVersion,
      panels: [createPanelJSONFixture({ title: 'Panel 1', options: deprecatedOptions })],
    });

    // Update title for the first panel
    dashboard.updatePanels([
      {
        ...dashboard.panels[0],
        title: 'New title',
      },
      ...dashboard.panels.slice(1),
    ]);

    // Call the function to test
    const result = getDashboardChanges(dashboard);

    // Assertions
    expect(result.userChanges).toEqual({
      panels: [
        {
          op: 'replace',
          originalValue: 'Panel 1',
          value: 'New title',
          startLineNumber: expect.any(Number),
          path: ['panels', '0', 'title'],
        },
      ],
    });
    expect(result.migrationChanges).toBeDefined();
    expect(result.userChanges).not.toContain({
      panels: [
        {
          op: 'replace',
          originalValue: 'Panel 1',
          value: 'New title',
          startLineNumber: expect.any(Number),
          path: ['panels', '0', 'title'],
        },
      ],
    });
  });
});
