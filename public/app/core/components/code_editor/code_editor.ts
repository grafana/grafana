///<reference path="../../../headers/common.d.ts" />

// import angular from 'angular';
import coreModule from 'app/core/core_module';
import ace from 'ace';

// Trick for loading additional modules
ace.config.setModuleUrl("ace/theme/solarized_dark", "public/vendor/npm/ace-builds/src-noconflict/theme-solarized_dark.js");

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
