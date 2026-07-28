import { type FieldConfigSource, type PanelModel } from '@grafana/data';

import { TextMode, type Options } from '../../schemas/textng/panelcfg.gen';

import { textPanelMigrationHandler } from './textPanelMigrationHandler';

describe('textPanelMigrationHandler', () => {
  describe('when invoked and previous version was old Angular text panel', () => {
    it('then should migrate options', () => {
      const panel = {
        content: '<span>Hello World<span>',
        mode: 'html',
        options: {},
      };

      const result = textPanelMigrationHandler(panel as unknown as PanelModel);

      expect(result.content).toEqual('<span>Hello World<span>');
      expect(result.mode).toEqual('html');
      expect(panel.content).toBeUndefined();
      expect(panel.mode).toBeUndefined();
    });

    it('then should keep the content when the legacy mode is missing', () => {
      const panel = {
        content: '<span>Hello World<span>',
        mode: undefined,
        options: {},
      };

      const result = textPanelMigrationHandler(panel as unknown as PanelModel);

      expect(result.content).toEqual('<span>Hello World<span>');
      expect(result.mode).toEqual(TextMode.Markdown);
    });

    it('then should not throw when options are missing', () => {
      const panel = {
        content: '<span>Hello World<span>',
        mode: 'html',
      };

      const result = textPanelMigrationHandler(panel as unknown as PanelModel);

      expect(result.content).toEqual('<span>Hello World<span>');
      expect(result.mode).toEqual('html');
    });
  });

  describe('when invoked and previous version 7.1 or later', () => {
    it('then not migrate options', () => {
      const panel = {
        content: '<span>Hello World<span>',
        mode: 'html',
        options: { content: 'New content', mode: TextMode.Markdown },
        pluginVersion: '7.1.0',
      };

      const result = textPanelMigrationHandler(panel as unknown as PanelModel);

      expect(result.content).toEqual('New content');
    });
  });

  describe('when invoked and previous version was not old Angular text panel', () => {
    it('then should just pass options through', () => {
      const panel: PanelModel<Options> = {
        id: 1,
        type: 'textng',
        fieldConfig: {} as unknown as FieldConfigSource,
        options: {
          content: '# Title',
          mode: TextMode.Markdown,
        },
      };

      const result = textPanelMigrationHandler(panel);

      expect(result.content).toEqual('# Title');
      expect(result.mode).toEqual('markdown');
    });
  });

  describe('when invoked and previous version was using text mode', () => {
    it('then should switch to markdown', () => {
      const mode = 'text' as unknown as TextMode;
      const panel: PanelModel<Options> = {
        id: 1,
        type: 'textng',
        fieldConfig: {} as unknown as FieldConfigSource,
        options: {
          content: '# Title',
          mode,
        },
      };

      const result = textPanelMigrationHandler(panel);

      expect(result.content).toEqual('# Title');
      expect(result.mode).toEqual('markdown');
    });
  });
});
