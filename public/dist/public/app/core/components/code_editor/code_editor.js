/**
 * codeEditor directive based on Ace code editor
 * https://github.com/ajaxorg/ace
 *
 * Basic usage:
 * <code-editor content="ctrl.target.query" on-change="ctrl.panelCtrl.refresh()"
 *  data-mode="sql" data-show-gutter>
 * </code-editor>
 *
 * Params:
 * content:      Editor content.
 * onChange:     Function called on content change (invoked on editor blur, ctrl+enter, not on every change).
 * getCompleter: Function returned external completer. Completer is an object implemented getCompletions() method,
 *               see Prometheus Data Source implementation for details.
 *
 * Some Ace editor options available via data-* attributes:
 * data-mode               - Language mode (text, sql, javascript, etc.). Default is 'text'.
 * data-theme              - Editor theme (eg 'solarized_dark').
 * data-max-lines          - Max editor height in lines. Editor grows automatically from 1 to maxLines.
 * data-show-gutter        - Show gutter (contains line numbers and additional info).
 * data-tab-size           - Tab size, default is 2.
 * data-behaviours-enabled - Specifies whether to use behaviors or not. "Behaviors" in this case is the auto-pairing of
 *                           special characters, like quotation marks, parenthesis, or brackets.
 * data-snippets-enabled   - Specifies whether to use snippets or not. "Snippets" are small pieces of code that can be
 *                           inserted via the completion box.
 *
 * Keybindings:
 * Ctrl-Enter (Command-Enter): run onChange() function
 */
import { __awaiter, __generator } from "tslib";
import coreModule from 'app/core/core_module';
import config from 'app/core/config';
var DEFAULT_THEME_DARK = 'ace/theme/grafana-dark';
var DEFAULT_THEME_LIGHT = 'ace/theme/textmate';
var DEFAULT_MODE = 'text';
var DEFAULT_MAX_LINES = 10;
var DEFAULT_TAB_SIZE = 2;
var DEFAULT_BEHAVIORS = true;
var DEFAULT_SNIPPETS = true;
var editorTemplate = "<div></div>";
function link(scope, elem, attrs) {
    return __awaiter(this, void 0, void 0, function () {
        function setLangMode(lang) {
            ace.acequire('ace/ext/language_tools');
            codeEditor.setOptions({
                enableBasicAutocompletion: true,
                enableLiveAutocompletion: true,
                enableSnippets: snippetsEnabled,
            });
            if (scope.getCompleter()) {
                // make copy of array as ace seems to share completers array between instances
                var anyEditor = codeEditor;
                anyEditor.completers = anyEditor.completers.slice();
                anyEditor.completers.push(scope.getCompleter());
            }
            var aceModeName = "ace/mode/" + lang;
            editorSession.setMode(aceModeName);
        }
        function setThemeMode() {
            var theme = DEFAULT_THEME_DARK;
            if (config.bootData.user.lightTheme) {
                theme = DEFAULT_THEME_LIGHT;
            }
            codeEditor.setTheme(theme);
        }
        function setEditorContent(value) {
            codeEditor.setValue(value);
            codeEditor.clearSelection();
        }
        var langMode, maxLines, showGutter, tabSize, behavioursEnabled, snippetsEnabled, aceElem, ace, codeEditor, editorSession, editorOptions, textarea;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    langMode = attrs.mode || DEFAULT_MODE;
                    maxLines = attrs.maxLines || DEFAULT_MAX_LINES;
                    showGutter = attrs.showGutter !== undefined;
                    tabSize = attrs.tabSize || DEFAULT_TAB_SIZE;
                    behavioursEnabled = attrs.behavioursEnabled ? attrs.behavioursEnabled === 'true' : DEFAULT_BEHAVIORS;
                    snippetsEnabled = attrs.snippetsEnabled ? attrs.snippetsEnabled === 'true' : DEFAULT_SNIPPETS;
                    aceElem = elem.get(0);
                    return [4 /*yield*/, import(/* webpackChunkName: "brace" */ 'brace')];
                case 1:
                    ace = (_a.sent()).default;
                    return [4 /*yield*/, import('brace/ext/language_tools')];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, import('brace/theme/textmate')];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, import('brace/mode/text')];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, import('brace/snippets/text')];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, import('brace/mode/sql')];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, import('brace/snippets/sql')];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, import('brace/mode/sqlserver')];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, import('brace/snippets/sqlserver')];
                case 9:
                    _a.sent();
                    return [4 /*yield*/, import('brace/mode/markdown')];
                case 10:
                    _a.sent();
                    return [4 /*yield*/, import('brace/snippets/markdown')];
                case 11:
                    _a.sent();
                    return [4 /*yield*/, import('brace/mode/json')];
                case 12:
                    _a.sent();
                    return [4 /*yield*/, import('brace/snippets/json')];
                case 13:
                    _a.sent();
                    // @ts-ignore
                    return [4 /*yield*/, import('./theme-grafana-dark')];
                case 14:
                    // @ts-ignore
                    _a.sent();
                    codeEditor = ace.edit(aceElem);
                    editorSession = codeEditor.getSession();
                    editorOptions = {
                        maxLines: maxLines,
                        showGutter: showGutter,
                        tabSize: tabSize,
                        behavioursEnabled: behavioursEnabled,
                        highlightActiveLine: false,
                        showPrintMargin: false,
                        autoScrollEditorIntoView: true, // this is needed if editor is inside scrollable page
                    };
                    // Set options
                    codeEditor.setOptions(editorOptions);
                    // disable depreacation warning
                    codeEditor.$blockScrolling = Infinity;
                    // Padding hacks
                    codeEditor.renderer.setScrollMargin(10, 10);
                    codeEditor.renderer.setPadding(10);
                    setThemeMode();
                    setLangMode(langMode);
                    setEditorContent(scope.content);
                    // Add classes
                    elem.addClass('gf-code-editor');
                    textarea = elem.find('textarea');
                    textarea.addClass('gf-form-input');
                    if (scope.codeEditorFocus) {
                        setTimeout(function () {
                            textarea.focus();
                            var domEl = textarea[0];
                            if (domEl.setSelectionRange) {
                                var pos = textarea.val().length * 2;
                                domEl.setSelectionRange(pos, pos);
                            }
                        }, 100);
                    }
                    // Event handlers
                    editorSession.on('change', function (e) {
                        scope.$apply(function () {
                            var newValue = codeEditor.getValue();
                            scope.content = newValue;
                        });
                    });
                    // Sync with outer scope - update editor content if model has been changed from outside of directive.
                    scope.$watch('content', function (newValue, oldValue) {
                        var editorValue = codeEditor.getValue();
                        if (newValue !== editorValue && newValue !== oldValue) {
                            scope.$$postDigest(function () {
                                setEditorContent(newValue);
                            });
                        }
                    });
                    codeEditor.on('blur', function () {
                        scope.onChange();
                    });
                    scope.$on('$destroy', function () {
                        codeEditor.destroy();
                    });
                    // Keybindings
                    codeEditor.commands.addCommand({
                        name: 'executeQuery',
                        bindKey: { win: 'Ctrl-Enter', mac: 'Command-Enter' },
                        exec: function () {
                            scope.onChange();
                        },
                    });
                    return [2 /*return*/];
            }
        });
    });
}
export function codeEditorDirective() {
    return {
        restrict: 'E',
        template: editorTemplate,
        scope: {
            content: '=',
            datasource: '=',
            codeEditorFocus: '<',
            onChange: '&',
            getCompleter: '&',
        },
        link: link,
    };
}
coreModule.directive('codeEditor', codeEditorDirective);
//# sourceMappingURL=code_editor.js.map