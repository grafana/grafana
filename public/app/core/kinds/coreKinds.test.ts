import { CORE_KINDS } from './coreKinds';
import { coversGroup } from './types';

describe('getRoute', () => {
  it('encodes the object name in its page path', () => {
    expect(CORE_KINDS.connection.getRoute('git hub/app')).toBe('/admin/provisioning/connections/git%20hub%2Fapp/edit');
  });

  it('adds a slug of the title to a dashboard page path', () => {
    expect(CORE_KINDS.dashboard.getRoute('abc', 'CPU Usage (prod)')).toBe('/d/abc/cpu-usage-prod');
  });

  it('leaves the slug out when no title is given', () => {
    expect(CORE_KINDS.dashboard.getRoute('abc')).toBe('/d/abc');
  });
});

// Data sources are the one kind whose `group` is a storage collection rather than a served group:
// each plugin serves its own `{plugin}.datasource.grafana.app`, and that is what the backend
// reports for an individual resource.
describe('coversGroup', () => {
  it('matches a served group inside the collection as well as the collection itself', () => {
    expect(coversGroup(CORE_KINDS.datasource, 'grafana-testdata-datasource.datasource.grafana.app')).toBe(true);
    expect(coversGroup(CORE_KINDS.datasource, 'datasource.grafana.app')).toBe(true);
  });

  it('does not match a group that merely looks similar', () => {
    expect(coversGroup(CORE_KINDS.datasource, 'notdatasource.grafana.app')).toBe(false);
    expect(coversGroup(CORE_KINDS.datasource, 'datasource.grafana.app.evil')).toBe(false);
  });

  it('leaves a kind served under its own group matching exactly', () => {
    expect(coversGroup(CORE_KINDS.dashboard, 'dashboard.grafana.app')).toBe(true);
    expect(coversGroup(CORE_KINDS.dashboard, 'v2.dashboard.grafana.app')).toBe(false);
  });
});
