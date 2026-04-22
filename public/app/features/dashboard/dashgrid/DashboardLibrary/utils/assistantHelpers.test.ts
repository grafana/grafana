import { of } from 'rxjs';

import { isAssistantAvailable } from '@grafana/assistant';
import { setTestFlags } from '@grafana/test-utils/unstable';

import {
  buildTemplateContextData,
  buildTemplateContextTitle,
  isSuggestedDashboardAssistantEnabled,
} from './assistantHelpers';
import { isGnetDashboard } from './dashboardLibraryHelpers';
import { createMockGnetDashboard, createMockPluginDashboard } from './test-utils';

jest.mock('@grafana/assistant', () => ({
  ...jest.requireActual('@grafana/assistant'),
  isAssistantAvailable: jest.fn(() => of(true)),
}));

describe('assistantHelpers', () => {
  describe('isSuggestedDashboardAssistantEnabled', () => {
    it('should return true when flag is enabled and assistant is available', async () => {
      setTestFlags({ suggestedDashboardsAssistantButton: true });

      await expect(isSuggestedDashboardAssistantEnabled()).resolves.toBe(true);
    });

    it('should return false when flag is disabled', async () => {
      setTestFlags({ suggestedDashboardsAssistantButton: false });

      await expect(isSuggestedDashboardAssistantEnabled()).resolves.toBe(false);
    });

    it('should return false when assistant is unavailable', async () => {
      setTestFlags({ suggestedDashboardsAssistantButton: true });
      jest.mocked(isAssistantAvailable).mockReturnValue(of(false));

      await expect(isSuggestedDashboardAssistantEnabled()).resolves.toBe(false);
    });
  });

  describe('isGnetDashboard', () => {
    it('should distinguish GnetDashboard from PluginDashboard', () => {
      expect(isGnetDashboard(createMockGnetDashboard())).toBe(true);
      expect(isGnetDashboard(createMockPluginDashboard())).toBe(false);
    });
  });

  describe('buildTemplateContextTitle', () => {
    it('should use dashboard.name for GnetDashboard with template_dashboard kind', () => {
      const gnetDashboard = createMockGnetDashboard({ name: 'Node Exporter Full' });
      const title = buildTemplateContextTitle(gnetDashboard, 'template_dashboard');
      expect(title).toBe('Dashboard Template: Node Exporter Full');
    });

    it('should use provided title for PluginDashboard with template_dashboard kind', () => {
      const pluginDashboard = createMockPluginDashboard({ title: 'My Plugin Dashboard' });
      const title = buildTemplateContextTitle(pluginDashboard, 'template_dashboard');
      expect(title).toBe('Dashboard Template: My Plugin Dashboard');
    });

    it('should not use "Template" prefix for suggested_dashboard kind', () => {
      const gnetDashboard = createMockGnetDashboard({ name: 'Node Exporter Full' });
      const title = buildTemplateContextTitle(gnetDashboard, 'suggested_dashboard');
      expect(title).toBe('Dashboard: Node Exporter Full');
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
