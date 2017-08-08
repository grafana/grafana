///<reference path="../../../headers/common.d.ts" />

import coreModule from 'app/core/core_module';
import ace from 'ace';

const ACE_SRC_BASE = "public/vendor/npm/ace-builds/src-noconflict/";

// Trick for loading additional modules
function fixModuleUrl(moduleType, name) {
  let aceModeName = `ace/${moduleType}/${name}`;
  let componentName = `${moduleType}-${name}.js`;
  if (moduleType === 'snippets') {
    componentName = `${moduleType}/${name}.js`;
  }
  ace.config.setModuleUrl(aceModeName, ACE_SRC_BASE + componentName);
}

fixModuleUrl("ext", "language_tools");

let editorTemplate = `<div></div>`;

function link(scope, elem, attrs) {
  // Options
  let langMode = attrs.mode || 'text';
  let theme = "solarized_dark";

  // Initialize editor
  let aceElem = elem.get(0);
  let codeEditor = ace.edit(aceElem);
  let editorSession = codeEditor.getSession();

  let editorOptions = {
    maxLines: 10,
    showGutter: false,
    highlightActiveLine: false,
    showPrintMargin: false,
    autoScrollEditorIntoView: true // this is needed if editor is inside scrollable page
  };

  // Set options
  codeEditor.setOptions(editorOptions);
  // disable depreacation warning
  codeEditor.$blockScrolling = Infinity;
  // Padding hacks
  codeEditor.renderer.setScrollMargin(10, 10);
  codeEditor.renderer.setPadding(10);
  setThemeMode(theme);
  setLangMode(langMode);

  codeEditor.setValue(scope.content);
  codeEditor.clearSelection();

  // Add classes
  elem.addClass("gf-code-editor");
  let textarea = elem.find("textarea");
  textarea.addClass('gf-form-input');

  editorSession.on('change', (e) => {
    scope.$apply(() => {
      let newValue = codeEditor.getValue();
      scope.content = newValue;
    });
  });

  function setLangMode(lang) {
    let aceModeName = `ace/mode/${lang}`;
    fixModuleUrl("mode", lang);
    fixModuleUrl("snippets", lang);
    editorSession.setMode(aceModeName);
    ace.config.loadModule("ace/ext/language_tools", (language_tools) => {
      codeEditor.setOptions({
        enableBasicAutocompletion: true,
        enableLiveAutocompletion: true,
        enableSnippets: true
      });
    });
  }

  function setThemeMode(theme) {
    fixModuleUrl("theme", theme);
    let aceThemeName = `ace/theme/${theme}`;
    codeEditor.setTheme(aceThemeName);
  }
}

export function codeEditorDirective() {
  return {
    restrict: 'E',
    template: editorTemplate,
    scope: {
      content: "="
    },
    link: link
  };
}

coreModule.directive('codeEditor', codeEditorDirective);
