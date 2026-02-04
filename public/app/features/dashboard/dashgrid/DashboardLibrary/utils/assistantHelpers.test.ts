import {
  isGnetDashboard,
  buildAssistantPrompt,
  buildTemplateContextData,
  buildTemplateContextTitle,
} from './assistantHelpers';
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
      const title = buildTemplateContextTitle(gnetDashboard, 'Fallback Title');
      expect(title).toBe('Dashboard Template: Node Exporter Full');
    });

    it('should use provided title for PluginDashboard', () => {
      const pluginDashboard = createMockPluginDashboard();
      const title = buildTemplateContextTitle(pluginDashboard, 'My Plugin Dashboard');
      expect(title).toBe('Dashboard Template: My Plugin Dashboard');
    });
  });

  describe('buildTemplateContextData', () => {
    it('should only include datasource for suggested_dashboard with GnetDashboard', () => {
      const gnetDashboard = createMockGnetDashboard({ datasource: 'prometheus' });
      const pluginDashboard = createMockPluginDashboard();

      // Datasource only included for suggested + Gnet combination
      expect(buildTemplateContextData(gnetDashboard, 'Test', 'template_dashboard').datasource).toBeUndefined();
      expect(buildTemplateContextData(gnetDashboard, 'Test', 'suggested_dashboard').datasource).toBe('prometheus');
      expect(buildTemplateContextData(pluginDashboard, 'Test', 'suggested_dashboard').datasource).toBeUndefined();
    });

    it('should use dashboard.name for GnetDashboard, provided title for PluginDashboard', () => {
      const gnetDashboard = createMockGnetDashboard({ name: 'Node Exporter' });
      const pluginDashboard = createMockPluginDashboard();

      expect(buildTemplateContextData(gnetDashboard, 'Fallback', 'template_dashboard').templateName).toBe(
        'Node Exporter'
      );
      expect(buildTemplateContextData(pluginDashboard, 'Custom Title', 'template_dashboard').templateName).toBe(
        'Custom Title'
      );
    });

    it('should fallback to userName when orgName is not available', () => {
      const gnetDashboard = createMockGnetDashboard({ orgName: undefined, userName: 'community-user' });
      expect(buildTemplateContextData(gnetDashboard, 'Test', 'template_dashboard').author).toBe('community-user');
    });
  });

  describe('buildAssistantPrompt', () => {
    it('should include title in prompt', () => {
      const prompt = buildAssistantPrompt(createMockGnetDashboard(), 'My Dashboard', 'template_dashboard');
      expect(prompt).toContain('My Dashboard');
    });

    it('should include datasource for suggested_dashboard but not for template_dashboard', () => {
      const gnetDashboard = createMockGnetDashboard({ datasource: 'prometheus' });

      const templatePrompt = buildAssistantPrompt(gnetDashboard, 'Test', 'template_dashboard');
      const suggestedPrompt = buildAssistantPrompt(gnetDashboard, 'Test', 'suggested_dashboard');

      expect(templatePrompt).not.toContain('prometheus');
      expect(suggestedPrompt).toContain('prometheus');
    });

    it('should include description when available', () => {
      const withDescription = createMockGnetDashboard({ description: 'Monitors servers' });
      const withoutDescription = createMockGnetDashboard({ description: '' });

      expect(buildAssistantPrompt(withDescription, 'Test', 'template_dashboard')).toContain('Monitors servers');
      expect(buildAssistantPrompt(withoutDescription, 'Test', 'template_dashboard')).not.toContain('Description:');
    });
  });
});
