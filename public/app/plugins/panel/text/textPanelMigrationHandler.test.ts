import { textPanelMigrationHandler } from './textPanelMigrationHandler';
import { TextMode, TextOptions } from './types';
import { FieldConfigSource, PanelModel } from '@grafana/data';

describe('textPanelMigrationHandler', () => {
  describe('when invoked and previous version was old Angular text panel', () => {
    it('then should migrate options', () => {
      const panel: any = {
        content: '<span>Hello World<span>',
        mode: 'html',
        options: {},
      };

      const result = textPanelMigrationHandler(panel);

      expect(result.content).toEqual('<span>Hello World<span>');
      expect(result.mode).toEqual('html');
      expect(panel.content).toBeUndefined();
      expect(panel.mode).toBeUndefined();
    });
  });

  describe('when invoked and previous version 7.1 or later', () => {
    it('then not migrate options', () => {
      const panel: any = {
        content: '<span>Hello World<span>',
        mode: 'html',
        options: { content: 'New content' },
        pluginVersion: '7.1.0',
      };

      const result = textPanelMigrationHandler(panel);

      expect(result.content).toEqual('New content');
    });
  });

  describe('when invoked and previous version was not old Angular text panel', () => {
    it('then should just pass options through', () => {
      const panel: PanelModel<TextOptions> = {
        id: 1,
        fieldConfig: ({} as unknown) as FieldConfigSource,
        options: {
          content: `# Title

        For markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)
      `,
          mode: 'markdown',
        },
      };

      const result = textPanelMigrationHandler(panel);

      expect(result.content).toEqual(`# Title

        For markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)
      `);
      expect(result.mode).toEqual('markdown');
    });
  });

  describe('when invoked and previous version was using text mode', () => {
    it('then should switch to markdown', () => {
      const mode = ('text' as unknown) as TextMode;
      const panel: PanelModel<TextOptions> = {
        id: 1,
        fieldConfig: ({} as unknown) as FieldConfigSource,
        options: {
          content: `# Title

        For markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)
      `,
          mode,
        },
      };

      const result = textPanelMigrationHandler(panel);

      expect(result.content).toEqual(`# Title

        For markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)
      `);
      expect(result.mode).toEqual('markdown');
    });
  });
});
