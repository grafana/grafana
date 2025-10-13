import { resolveSelectors } from './resolver';
import { versionedComponents } from './selectors/components';
import { versionedPages } from './selectors/pages';

describe('Resolver', () => {
  it('should resolve latest when no version is provided', () => {
    const pages = resolveSelectors(versionedPages);
    const components = resolveSelectors(versionedComponents);
    expect(components.CodeEditor.container).toBe('data-testid Code editor container');
    expect(components.TimePicker.calendar.closeButton).toBe('data-testid Close time range Calendar');
    expect(components.Panels.Panel.status('Test')).toBe('data-testid Panel status Test');
    expect(components.PanelEditor.OptionsPane.fieldInput('Test')).toBe(
      'data-testid Panel editor option pane field input Test'
    );
    expect(pages.Alerting.AddAlertRule.url).toBe('/alerting/new/alerting');
    expect(pages.AddDashboard.Settings.Variables.Edit.url('test')).toBe(
      '/dashboard/new?orgId=1&editview=variables&editIndex=test'
    );
  });

  it('should resolve right selector versions when an older grafana version is provided', () => {
    const pages = resolveSelectors(versionedPages, '10.0.14');
    const components = resolveSelectors(versionedComponents, '10.0.14');
    expect(components.CodeEditor.container).toBe('Code editor container');
    expect(components.TimePicker.calendar.closeButton).toBe('Close time range Calendar');
    expect(components.Panels.Panel.status('')).toBe('Panel status');
    expect(components.PanelEditor.OptionsPane.fieldInput('Test')).toBe(
      'data-testid Panel editor option pane field input Test'
    );
    expect(pages.Alerting.AddAlertRule.url).toBe('/alerting/new');
    expect(pages.AddDashboard.Settings.Variables.Edit.url('test')).toBe(
      '/dashboard/new?orgId=1&editview=templating&editIndex=test'
    );
  });

  it('should resolve the most recent selector version when a newer grafana version is provided', () => {
    const pages = resolveSelectors(
      {
        Alerting: {
          AddAlertRule: {
            url: {
              '11.4.0': '/alerting/new',
              '11.1.0': '/alerting/old',
              '9.0.15': '/alerting/new/alerting',
            },
          },
        },
      },
      '25.1.0'
    );
    expect(pages.Alerting.AddAlertRule.url).toBe('/alerting/new');
  });

  it('should throw error if an invalid semver range is used in versioned selector', () => {
    expect(() =>
      resolveSelectors({
        Alerting: {
          AddAlertRule: {
            url: {
              abc: '/alerting/new',
              '9.0.15': '/alerting/new/alerting',
            },
          },
        },
      })
    ).toThrow(new Error("Invalid semver version: 'abc'"));
  });
});
