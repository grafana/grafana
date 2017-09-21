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
 *
 * Keybindings:
 * Ctrl-Enter (Command-Enter): run onChange() function
 */

///<reference path="../../../headers/common.d.ts" />
import _ from 'lodash';
import coreModule from 'app/core/core_module';
import config from 'app/core/config';
import ace from 'ace';

const ACE_SRC_BASE = "public/vendor/npm/ace-builds/src-noconflict/";
const DEFAULT_THEME_DARK = "grafana-dark";
const DEFAULT_THEME_LIGHT = "textmate";
const DEFAULT_MODE = "text";
const DEFAULT_MAX_LINES = 10;
const DEFAULT_TAB_SIZE = 2;
const DEFAULT_BEHAVIOURS = true;

const GRAFANA_MODULES = ['theme-grafana-dark'];
const GRAFANA_MODULE_BASE = "public/app/core/components/code_editor/";

// Trick for loading additional modules
function setModuleUrl(moduleType, name, pluginBaseUrl = null) {
  let baseUrl = ACE_SRC_BASE;
  let aceModeName = `ace/${moduleType}/${name}`;
  let moduleName = `${moduleType}-${name}`;
  let componentName = `${moduleName}.js`;

  if (_.includes(GRAFANA_MODULES, moduleName)) {
    baseUrl = GRAFANA_MODULE_BASE;
  }

  if (pluginBaseUrl) {
    baseUrl = pluginBaseUrl + '/';
  }

  if (moduleType === 'snippets') {
    componentName = `${moduleType}/${name}.js`;
  }

  ace.config.setModuleUrl(aceModeName, baseUrl + componentName);
}

setModuleUrl("ext", "language_tools");
setModuleUrl("mode", "text");
setModuleUrl("snippets", "text");

let editorTemplate = `<div></div>`;

function link(scope, elem, attrs) {
  let lightTheme = config.bootData.user.lightTheme;
  let default_theme = lightTheme ? DEFAULT_THEME_LIGHT : DEFAULT_THEME_DARK;

  // Options
  let langMode = attrs.mode || DEFAULT_MODE;
  let maxLines = attrs.maxLines || DEFAULT_MAX_LINES;
  let showGutter = attrs.showGutter !== undefined;
  let theme = attrs.theme || default_theme;
  let tabSize = attrs.tabSize || DEFAULT_TAB_SIZE;
  let behavioursEnabled = attrs.behavioursEnabled ? attrs.behavioursEnabled === 'true' : DEFAULT_BEHAVIOURS;

  // Initialize editor
  let aceElem = elem.get(0);
  let codeEditor = ace.edit(aceElem);
  let editorSession = codeEditor.getSession();

  let editorOptions = {
    maxLines: maxLines,
    showGutter: showGutter,
    tabSize: tabSize,
    behavioursEnabled: behavioursEnabled,
    highlightActiveLine: false,
    showPrintMargin: false,
    autoScrollEditorIntoView: true // this is needed if editor is inside scrollable page
  };

  // Set options
  codeEditor.setOptions(editorOptions);
  // disable depreacation warning
  codeEditor.$blockScrolling = Infinity;
  // Padding hacks
  codeEditor.renderer.setScrollMargin(15, 15);
  codeEditor.renderer.setPadding(10);

  setThemeMode(theme);
  setLangMode(langMode);
  setEditorContent(scope.content);

  // Add classes
  elem.addClass("gf-code-editor");
  let textarea = elem.find("textarea");
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
  editorSession.on('change', (e) => {
    scope.$apply(() => {
      let newValue = codeEditor.getValue();
      scope.content = newValue;
    });
  });

  // Sync with outer scope - update editor content if model has been changed from outside of directive.
  scope.$watch('content', (newValue, oldValue) => {
    let editorValue = codeEditor.getValue();
    if (newValue !== editorValue && newValue !== oldValue) {
      scope.$$postDigest(function() {
        setEditorContent(newValue);
      });
    }
  });

  codeEditor.on('blur', () => {
    scope.onChange();
  });

  scope.$on("$destroy", () => {
    codeEditor.destroy();
  });

  // Keybindings
  codeEditor.commands.addCommand({
    name: 'executeQuery',
    bindKey: {win: 'Ctrl-Enter', mac: 'Command-Enter'},
    exec: () => {
      scope.onChange();
    }
  });

  function setLangMode(lang) {
    let aceModeName = `ace/mode/${lang}`;
    setModuleUrl("mode", lang, scope.datasource.meta.baseUrl || null);
    setModuleUrl("snippets", lang, scope.datasource.meta.baseUrl || null);
    editorSession.setMode(aceModeName);

    ace.config.loadModule("ace/ext/language_tools", (language_tools) => {
      codeEditor.setOptions({
        enableBasicAutocompletion: true,
        enableLiveAutocompletion: true,
        enableSnippets: true
      });

      if (scope.getCompleter()) {
        // make copy of array as ace seems to share completers array between instances
        codeEditor.completers = codeEditor.completers.slice();
        codeEditor.completers.push(scope.getCompleter());
      }
    });
  }

  function setThemeMode(theme) {
    setModuleUrl("theme", theme);
    let themeModule = `ace/theme/${theme}`;
    ace.config.loadModule(themeModule, (theme_module) => {
      // Check is theme light or dark and fix if needed
      let lightTheme = config.bootData.user.lightTheme;
      let fixedTheme = theme;
      if (lightTheme && theme_module.isDark) {
        fixedTheme = DEFAULT_THEME_LIGHT;
      } else if (!lightTheme && !theme_module.isDark) {
        fixedTheme = DEFAULT_THEME_DARK;
      }
      setModuleUrl("theme", fixedTheme);
      themeModule = `ace/theme/${fixedTheme}`;
      codeEditor.setTheme(themeModule);

      elem.addClass("gf-code-editor--theme-loaded");
    });
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
      content: "=",
      datasource: "=",
      codeEditorFocus: "<",
      onChange: "&",
      getCompleter: "&"
    },
    link: link
  };
}

coreModule.directive('codeEditor', codeEditorDirective);
