///<reference path="../../../headers/common.d.ts" />

// import angular from 'angular';
import coreModule from 'app/core/core_module';
import ace from 'ace';

const ACE_SRC_BASE = "public/vendor/npm/ace-builds/src-noconflict/";

// Trick for loading additional modules
function fixModuleUrl(moduleType, name) {
  let aceModeName = `ace/${moduleType}/${name}`;
  ace.config.setModuleUrl(aceModeName, ACE_SRC_BASE + `${moduleType}-${name}.js`);
}

fixModuleUrl("theme", "solarized_dark");

let editorTemplate = `
  <div class="gf-code-editor"></div>
`;

function link(scope, elem, attrs) {
  let aceElem = elem.get(0);
  let codeEditor = ace.edit(aceElem);
  let editorSession = codeEditor.getSession();
  codeEditor.setTheme("ace/theme/solarized_dark");
  codeEditor.setHighlightActiveLine(false);
  codeEditor.setShowPrintMargin(false);
  codeEditor.$blockScrolling = Infinity;
  setLangMode();

  codeEditor.setValue(scope.content);
  codeEditor.clearSelection();

  elem.addClass("gf-code-editor");
  let textarea = elem.find("textarea");
  textarea.addClass('gf-form-input width-25');
  textarea.attr("rows", "4");

  editorSession.on('change', e => {
    scope.$apply(() => {
      let newValue = codeEditor.getValue();
      scope.content = newValue;
    });
  });

  function setLangMode() {
    let lang = attrs.mode || 'text';
    let aceModeName = `ace/mode/${lang}`;
    fixModuleUrl("mode", lang);
    editorSession.setMode(aceModeName);
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
