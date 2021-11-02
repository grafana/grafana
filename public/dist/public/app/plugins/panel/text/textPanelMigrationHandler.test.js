import { textPanelMigrationHandler } from './textPanelMigrationHandler';
import { TextMode } from './models.gen';
describe('textPanelMigrationHandler', function () {
    describe('when invoked and previous version was old Angular text panel', function () {
        it('then should migrate options', function () {
            var panel = {
                content: '<span>Hello World<span>',
                mode: 'html',
                options: {},
            };
            var result = textPanelMigrationHandler(panel);
            expect(result.content).toEqual('<span>Hello World<span>');
            expect(result.mode).toEqual('html');
            expect(panel.content).toBeUndefined();
            expect(panel.mode).toBeUndefined();
        });
    });
    describe('when invoked and previous version 7.1 or later', function () {
        it('then not migrate options', function () {
            var panel = {
                content: '<span>Hello World<span>',
                mode: 'html',
                options: { content: 'New content' },
                pluginVersion: '7.1.0',
            };
            var result = textPanelMigrationHandler(panel);
            expect(result.content).toEqual('New content');
        });
    });
    describe('when invoked and previous version was not old Angular text panel', function () {
        it('then should just pass options through', function () {
            var panel = {
                id: 1,
                fieldConfig: {},
                options: {
                    content: "# Title\n\n        For markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)\n      ",
                    mode: TextMode.Markdown,
                },
            };
            var result = textPanelMigrationHandler(panel);
            expect(result.content).toEqual("# Title\n\n        For markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)\n      ");
            expect(result.mode).toEqual('markdown');
        });
    });
    describe('when invoked and previous version was using text mode', function () {
        it('then should switch to markdown', function () {
            var mode = 'text';
            var panel = {
                id: 1,
                fieldConfig: {},
                options: {
                    content: "# Title\n\n        For markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)\n      ",
                    mode: mode,
                },
            };
            var result = textPanelMigrationHandler(panel);
            expect(result.content).toEqual("# Title\n\n        For markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)\n      ");
            expect(result.mode).toEqual('markdown');
        });
    });
});
//# sourceMappingURL=textPanelMigrationHandler.test.js.map