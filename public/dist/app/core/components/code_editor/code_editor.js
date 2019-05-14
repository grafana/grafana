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
import coreModule from 'app/core/core_module';
import config from 'app/core/config';
import ace from 'brace';
import './theme-grafana-dark';
import 'brace/ext/language_tools';
import 'brace/theme/textmate';
import 'brace/mode/text';
import 'brace/snippets/text';
import 'brace/mode/sql';
import 'brace/snippets/sql';
import 'brace/mode/sqlserver';
import 'brace/snippets/sqlserver';
import 'brace/mode/markdown';
import 'brace/snippets/markdown';
import 'brace/mode/json';
import 'brace/snippets/json';
var DEFAULT_THEME_DARK = 'ace/theme/grafana-dark';
var DEFAULT_THEME_LIGHT = 'ace/theme/textmate';
var DEFAULT_MODE = 'text';
var DEFAULT_MAX_LINES = 10;
var DEFAULT_TAB_SIZE = 2;
var DEFAULT_BEHAVIORS = true;
var DEFAULT_SNIPPETS = true;
var editorTemplate = "<div></div>";
function link(scope, elem, attrs) {
    // Options
    var langMode = attrs.mode || DEFAULT_MODE;
    var maxLines = attrs.maxLines || DEFAULT_MAX_LINES;
    var showGutter = attrs.showGutter !== undefined;
    var tabSize = attrs.tabSize || DEFAULT_TAB_SIZE;
    var behavioursEnabled = attrs.behavioursEnabled ? attrs.behavioursEnabled === 'true' : DEFAULT_BEHAVIORS;
    var snippetsEnabled = attrs.snippetsEnabled ? attrs.snippetsEnabled === 'true' : DEFAULT_SNIPPETS;
    // Initialize editor
    var aceElem = elem.get(0);
    var codeEditor = ace.edit(aceElem);
    var editorSession = codeEditor.getSession();
    var editorOptions = {
        maxLines: maxLines,
        showGutter: showGutter,
        tabSize: tabSize,
        behavioursEnabled: behavioursEnabled,
        highlightActiveLine: false,
        showPrintMargin: false,
        autoScrollEditorIntoView: true,
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
    var textarea = elem.find('textarea');
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