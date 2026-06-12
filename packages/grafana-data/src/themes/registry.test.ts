import { getBuiltInThemes, getThemeById } from './registry';

describe('theme registry', () => {
  it('registers the ocean blue extra theme', () => {
    const extraThemeIds = getBuiltInThemes(['oceanblue']).map((theme) => theme.id);

    expect(extraThemeIds).toContain('oceanblue');
  });

  it('builds the ocean blue theme with dark mode colors', () => {
    const theme = getThemeById('oceanblue');

    expect(theme.name).toBe('Ocean blue');
    expect(theme.colors.mode).toBe('dark');
    expect(theme.colors.primary.main).toBe('#2E9FD6');
  });
});
