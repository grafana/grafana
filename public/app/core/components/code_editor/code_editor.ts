///<reference path="../../../headers/common.d.ts" />

// import angular from 'angular';
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

fixModuleUrl("theme", "solarized_dark");
fixModuleUrl("ext", "language_tools");

let editorTemplate = `<div></div>`;

function link(scope, elem, attrs) {
  let aceElem = elem.get(0);
  let codeEditor = ace.edit(aceElem);
  let editorSession = codeEditor.getSession();

  codeEditor.setTheme("ace/theme/solarized_dark");
  codeEditor.setHighlightActiveLine(false);
  codeEditor.setShowPrintMargin(false);
  // disable depreacation warning
  codeEditor.$blockScrolling = Infinity;
  setLangMode();

  codeEditor.setValue(scope.content);
  codeEditor.clearSelection();

  elem.addClass("gf-code-editor");
  let textarea = elem.find("textarea");
  textarea.addClass('gf-form-input width-25');
  textarea.attr("rows", "4");

  editorSession.on('change', (e) => {
    scope.$apply(() => {
      let newValue = codeEditor.getValue();
      scope.content = newValue;
    });
  });

  function setLangMode() {
    let lang = attrs.mode || 'text';
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
