import { getReadOnlyTooltipText } from './tooltip';

describe('getReadOnlyTooltipText', () => {
  it('points Source API resources at the source rather than Git', () => {
    const text = getReadOnlyTooltipText({ isSource: true });

    expect(text).toContain('provisioned from a Source API');
    expect(text).not.toContain('Git');
  });

  it('keeps the Git copy by default and the file copy for local repositories', () => {
    expect(getReadOnlyTooltipText({})).toContain('provisioned through Git');
    expect(getReadOnlyTooltipText({ isLocal: true })).toContain('provisioned through file provisioning');
  });
});
