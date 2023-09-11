export const SHARED_DEPENDENCY_PREFIX = 'package';
export const LOAD_PLUGIN_CSS_REGEX = /^plugins.+\.css$/i;
export const JS_CONTENT_TYPE_REGEX = /^(text|application)\/(x-)?javascript(;|$)/;
export const AMD_MODULE_REGEX =
  /(?:^\uFEFF?|[^$_a-zA-Z\xA0-\uFFFF.])define\s*\(\s*("[^"]+"\s*,\s*|'[^']+'\s*,\s*)?\s*(\[(\s*(("[^"]+"|'[^']+')\s*,|\/\/.*\r?\n))*(\s*("[^"]+"|'[^']+')\s*,?)?(\s*(\/\/.*\r?\n|\/\*\/))*\s*\]|function\s*|{|[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*\))/;
