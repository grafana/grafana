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

const DEFAULT_THEME_DARK = 'ace/theme/grafana-dark';
const DEFAULT_THEME_LIGHT = 'ace/theme/textmate';
const DEFAULT_MODE = 'text';
const DEFAULT_MAX_LINES = 10;
const DEFAULT_TAB_SIZE = 2;
const DEFAULT_BEHAVIORS = true;
const DEFAULT_SNIPPETS = true;

const editorTemplate = `<div></div>`;

async function link(scope: any, elem: any, attrs: any) {
  // Options
  const langMode = attrs.mode || DEFAULT_MODE;
  const maxLines = attrs.maxLines || DEFAULT_MAX_LINES;
  const showGutter = attrs.showGutter !== undefined;
  const tabSize = attrs.tabSize || DEFAULT_TAB_SIZE;
  const behavioursEnabled = attrs.behavioursEnabled ? attrs.behavioursEnabled === 'true' : DEFAULT_BEHAVIORS;
  const snippetsEnabled = attrs.snippetsEnabled ? attrs.snippetsEnabled === 'true' : DEFAULT_SNIPPETS;

  // Initialize editor
  const aceElem = elem.get(0);
  const { default: ace } = await import(/* webpackChunkName: "brace" */ 'brace');
  await import('brace/ext/language_tools');
  await import('brace/theme/textmate');
  await import('brace/mode/text');
  await import('brace/snippets/text');
  await import('brace/mode/sql');
  await import('brace/snippets/sql');
  await import('brace/mode/sqlserver');
  await import('brace/snippets/sqlserver');
  await import('brace/mode/markdown');
  await import('brace/snippets/markdown');
  await import('brace/mode/json');
  await import('brace/snippets/json');

  // @ts-ignore
  await import('./theme-grafana-dark');

  const codeEditor = ace.edit(aceElem);
  const editorSession = codeEditor.getSession();

  const editorOptions = {
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
  (codeEditor.renderer as any).setScrollMargin(10, 10);
  codeEditor.renderer.setPadding(10);

  setThemeMode();
  setLangMode(langMode);
  setEditorContent(scope.content);

  // Add classes
  elem.addClass('gf-code-editor');
  const textarea = elem.find('textarea');
  textarea.addClass('gf-form-input');

  if (scope.codeEditorFocus) {
    setTimeout(() => {
      textarea.focus();
      const domEl = textarea[0];
      if (domEl.setSelectionRange) {
        const pos = textarea.val().length * 2;
        domEl.setSelectionRange(pos, pos);
      }
    }, 100);
  }

  // Event handlers
  editorSession.on('change', e => {
    scope.$apply(() => {
      const newValue = codeEditor.getValue();
      scope.content = newValue;
    });
  });

  // Sync with outer scope - update editor content if model has been changed from outside of directive.
  scope.$watch('content', (newValue: any, oldValue: any) => {
    const editorValue = codeEditor.getValue();
    if (newValue !== editorValue && newValue !== oldValue) {
      scope.$$postDigest(() => {
        setEditorContent(newValue);
      });
    }
  });

  codeEditor.on('blur', () => {
    scope.onChange();
  });

  scope.$on('$destroy', () => {
    codeEditor.destroy();
  });

  // Keybindings
  codeEditor.commands.addCommand({
    name: 'executeQuery',
    bindKey: { win: 'Ctrl-Enter', mac: 'Command-Enter' },
    exec: () => {
      scope.onChange();
    },
  });

  function setLangMode(lang: string) {
    ace.acequire('ace/ext/language_tools');
    codeEditor.setOptions({
      enableBasicAutocompletion: true,
      enableLiveAutocompletion: true,
      enableSnippets: snippetsEnabled,
    });

    if (scope.getCompleter()) {
      // make copy of array as ace seems to share completers array between instances
      const anyEditor = codeEditor as any;
      anyEditor.completers = anyEditor.completers.slice();
      anyEditor.completers.push(scope.getCompleter());
    }

    const aceModeName = `ace/mode/${lang}`;
    editorSession.setMode(aceModeName);
  }

  function setThemeMode() {
    let theme = DEFAULT_THEME_DARK;
    if (config.bootData.user.lightTheme) {
      theme = DEFAULT_THEME_LIGHT;
    }

    codeEditor.setTheme(theme);
  }

  function setEditorContent(value: string) {
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
