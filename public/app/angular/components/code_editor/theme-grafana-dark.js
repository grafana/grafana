ace.define(
  'ace/theme/grafana-dark',
  ['require', 'exports', 'module', 'ace/lib/dom'],
  function (acequire, exports, module) {
    'use strict';

    exports.isDark = true;
    exports.cssClass = 'gf-code-dark';
    exports.cssText =
      '.gf-code-dark .ace_gutter {\
  background: #2f3129;\
  color: #8f908a\
  }\
  .gf-code-dark .ace_print-margin {\
  width: 1px;\
  background: #555651\
  }\
  .gf-code-dark {\
  background-color: #09090b;\
  color: #e0e0e0\
  }\
  .gf-code-dark .ace_cursor {\
  color: #f8f8f0\
  }\
  .gf-code-dark .ace_marker-layer .ace_selection {\
  background: #49483e\
  }\
  .gf-code-dark.ace_multiselect .ace_selection.ace_start {\
  box-shadow: 0 0 3px 0px #272822;\
  }\
  .gf-code-dark .ace_marker-layer .ace_step {\
  background: rgb(102, 82, 0)\
  }\
  .gf-code-dark .ace_marker-layer .ace_bracket {\
  margin: -1px 0 0 -1px;\
  border: 1px solid #49483e\
  }\
  .gf-code-dark .ace_marker-layer .ace_active-line {\
  background: #202020\
  }\
  .gf-code-dark .ace_gutter-active-line {\
  background-color: #272727\
  }\
  .gf-code-dark .ace_marker-layer .ace_selected-word {\
  border: 1px solid #49483e\
  }\
  .gf-code-dark .ace_invisible {\
  color: #52524d\
  }\
  .gf-code-dark .ace_entity.ace_name.ace_tag,\
  .gf-code-dark .ace_keyword,\
  .gf-code-dark .ace_meta.ace_tag,\
  .gf-code-dark .ace_storage {\
  color: #66d9ef\
  }\
  .gf-code-dark .ace_punctuation,\
  .gf-code-dark .ace_punctuation.ace_tag {\
  color: #fff\
  }\
  .gf-code-dark .ace_constant.ace_character,\
  .gf-code-dark .ace_constant.ace_language,\
  .gf-code-dark .ace_constant.ace_numeric,\
  .gf-code-dark .ace_constant.ace_other {\
  color: #fe85fc\
  }\
  .gf-code-dark .ace_invalid {\
  color: #f8f8f0;\
  background-color: #f92672\
  }\
  .gf-code-dark .ace_invalid.ace_deprecated {\
  color: #f8f8f0;\
  background-color: #ae81ff\
  }\
  .gf-code-dark .ace_support.ace_constant,\
  .gf-code-dark .ace_support.ace_function {\
  color: #59e6e3\
  }\
  .gf-code-dark .ace_fold {\
  background-color: #a6e22e;\
  border-color: #f8f8f2\
  }\
  .gf-code-dark .ace_storage.ace_type,\
  .gf-code-dark .ace_support.ace_class,\
  .gf-code-dark .ace_support.ace_type {\
  font-style: italic;\
  color: #66d9ef\
  }\
  .gf-code-dark .ace_entity.ace_name.ace_function,\
  .gf-code-dark .ace_entity.ace_other,\
  .gf-code-dark .ace_entity.ace_other.ace_attribute-name,\
  .gf-code-dark .ace_variable {\
  color: #a6e22e\
  }\
  .gf-code-dark .ace_variable.ace_parameter {\
  font-style: italic;\
  color: #fd971f\
  }\
  .gf-code-dark .ace_string {\
  color: #74e680\
  }\
  .gf-code-dark .ace_paren {\
    color: #f0a842\
  }\
  .gf-code-dark .ace_operator {\
    color: #FFF\
  }\
  .gf-code-dark .ace_comment {\
  color: #75715e\
  }\
  .gf-code-dark .ace_indent-guide {\
  background: url(data:image/png;base64,ivborw0kggoaaaansuheugaaaaeaaaaccayaaaczgbynaaaaekleqvqimwpq0fd0zxbzd/wpaajvaoxesgneaaaaaelftksuqmcc) right repeat-y\
  }';

    const dom = acequire('../lib/dom');
    dom.importCssString(exports.cssText, exports.cssClass);
  }
);
