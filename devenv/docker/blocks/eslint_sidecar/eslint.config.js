const security = require('eslint-plugin-security');
const sdl = require('@microsoft/eslint-plugin-sdl');
const tsParser = require('@typescript-eslint/parser');

// TODO: Consider adding eslint-plugin-no-unsanitized for more precise innerHTML/insertAdjacentHTML
// coverage. Currently excluded pending legal review of its MPL-2.0 licence — MPL-2.0 requires
// publishing modifications to the plugin itself but not application code. Verify this is acceptable
// before adding. The rules to enable would be:
//
//   'nounsanitized/method': 'error'    — document.write(), insertAdjacentHTML(), etc.
//   'nounsanitized/property': 'error'  — innerHTML, outerHTML assignments
//
// These provide more precise coverage than @microsoft/sdl/no-inner-html since they allow
// explicitly escaped/sanitized values while still blocking unsanitized ones.

module.exports = [
  security.configs.recommended,
  {
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: false },
    },
    plugins: { security, '@microsoft/sdl': sdl },
    rules: {
      // eslint-plugin-security — supply chain and dangerous patterns
      'security/detect-eval-with-expression': 'error',
      'security/detect-child-process': 'error',
      'security/detect-non-literal-fs-filename': 'error',
      'security/detect-non-literal-require': 'error',
      'security/detect-unsafe-regex': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-object-injection': 'warn',
      'security/detect-bidi-characters': 'error',
      'security/detect-non-literal-regexp': 'error',
      'security/detect-disable-mustache-escape': 'error',

      // ESLint core — code execution via string evaluation
      'no-new-func': 'error',
      'no-implied-eval': 'error',
      'no-script-url': 'error',

      // @microsoft/eslint-plugin-sdl — DOM manipulation and data leakage
      '@microsoft/sdl/no-inner-html': 'error',
      '@microsoft/sdl/no-document-write': 'error',
      '@microsoft/sdl/no-postmessage-star-origin': 'error',
      '@microsoft/sdl/no-insecure-url': 'warn',
    },
  },
];
