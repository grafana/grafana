import { regexp } from '@betterer/regexp';
import { eslint } from '@betterer/eslint';

export default {
  'no enzyme tests': () => regexp(/from 'enzyme'/g).include('**/*.test.*'),
  'no type assertions': () =>
    eslint({
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        {
          assertionStyle: 'never',
        },
      ],
    }).include('**/*.{ts,tsx}'),
  'no explicit any': () =>
    eslint({
      '@typescript-eslint/no-explicit-any': 'error',
    }).include('**/*.{ts,tsx}'),
};
