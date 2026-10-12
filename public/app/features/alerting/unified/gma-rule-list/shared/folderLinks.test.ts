import { makeFolderRulesLink } from './folderLinks';

describe('makeFolderRulesLink', () => {
  it('builds the folder alert view URL with a slug of the title', () => {
    expect(makeFolderRulesLink('abc123', 'My Team Alerts!')).toBe('/dashboards/f/abc123/my-team-alerts/alerting');
  });

  it('falls back to the uid when the title has no URL-safe characters', () => {
    expect(makeFolderRulesLink('abc123', '!!!')).toBe('/dashboards/f/abc123/abc123/alerting');
  });
});
