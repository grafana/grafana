import { textPanelMigrationHandler } from './textPanelMigrationHandler';
import { TextOptions } from './types';
import { FieldConfigSource, PanelModel } from '@grafana/data';

describe('textPanelMigrationHandler', () => {
  describe('when invoked and previous version was old Angular text panel', () => {
    it('then should migrate options', () => {
      const panel: any = {
        content: '<span>Hello World<span>',
        mode: 'html',
      };

      const result = textPanelMigrationHandler(panel);

      expect(result.content).toEqual('<span>Hello World<span>');
      expect(result.mode).toEqual('html');
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
      const panel: PanelModel<TextOptions> = {
        id: 1,
        fieldConfig: ({} as unknown) as FieldConfigSource,
        options: {
          content: `# Title

        For markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)
      `,
          mode: 'text',
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
