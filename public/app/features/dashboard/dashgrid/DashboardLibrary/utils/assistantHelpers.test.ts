import { buildTemplateContextData, buildTemplateContextTitle } from './assistantHelpers';
import { isGnetDashboard } from './dashboardLibraryHelpers';
import { createMockGnetDashboard, createMockPluginDashboard } from './test-utils';

describe('assistantHelpers', () => {
  describe('isGnetDashboard', () => {
    it('should distinguish GnetDashboard from PluginDashboard', () => {
      expect(isGnetDashboard(createMockGnetDashboard())).toBe(true);
      expect(isGnetDashboard(createMockPluginDashboard())).toBe(false);
    });
  });

  describe('buildTemplateContextTitle', () => {
    it('should use dashboard.name for GnetDashboard', () => {
      const gnetDashboard = createMockGnetDashboard({ name: 'Node Exporter Full' });
      const title = buildTemplateContextTitle(gnetDashboard);
      expect(title).toBe('Dashboard Template: Node Exporter Full');
    });

    it('should use provided title for PluginDashboard', () => {
      const pluginDashboard = createMockPluginDashboard({ title: 'My Plugin Dashboard' });
      const title = buildTemplateContextTitle(pluginDashboard);
      expect(title).toBe('Dashboard Template: My Plugin Dashboard');
    });
  });

  describe('buildTemplateContextData', () => {
    it('should only include datasource for suggested_dashboard with GnetDashboard', () => {
      const gnetDashboard = createMockGnetDashboard({ datasource: 'prometheus' });
      const pluginDashboard = createMockPluginDashboard();

      // Datasource only included for suggested + Gnet combination
      expect(buildTemplateContextData(gnetDashboard, 'template_dashboard').datasource).toBeUndefined();
      expect(buildTemplateContextData(gnetDashboard, 'suggested_dashboard').datasource).toBe('prometheus');
      expect(buildTemplateContextData(pluginDashboard, 'suggested_dashboard').datasource).toBeUndefined();
    });

    it('should use dashboard.name for GnetDashboard, provided title for PluginDashboard', () => {
      const gnetDashboard = createMockGnetDashboard({ name: 'Node Exporter' });
      const pluginDashboard = createMockPluginDashboard({ title: 'Custom Title' });

      expect(buildTemplateContextData(gnetDashboard, 'template_dashboard').templateName).toBe('Node Exporter');
      expect(buildTemplateContextData(pluginDashboard, 'template_dashboard').templateName).toBe('Custom Title');
    });

    it('should fallback to userName when orgName is not available', () => {
      const gnetDashboard = createMockGnetDashboard({ orgName: undefined, userName: 'community-user' });
      expect(buildTemplateContextData(gnetDashboard, 'template_dashboard').author).toBe('community-user');
    });
  });

  describe('buildTemplateContextData instructions', () => {
    it('should include datasource in instructions for suggested_dashboard but not for template_dashboard', () => {
      const gnetDashboard = createMockGnetDashboard({ datasource: 'prometheus' });

      const templateData = buildTemplateContextData(gnetDashboard, 'template_dashboard');
      const suggestedData = buildTemplateContextData(gnetDashboard, 'suggested_dashboard');

      expect(templateData.instructions).not.toContain('prometheus');
      expect(suggestedData.instructions).toContain('prometheus');
    });

    it('should include description in instructions when available', () => {
      const withDescription = createMockGnetDashboard({ description: 'Monitors servers' });
      const withoutDescription = createMockGnetDashboard({ description: '' });

      expect(buildTemplateContextData(withDescription, 'template_dashboard').instructions).toContain(
        'Monitors servers'
      );
      expect(buildTemplateContextData(withoutDescription, 'template_dashboard').instructions).not.toContain(
        'Description:'
      );
    });
  });
});
