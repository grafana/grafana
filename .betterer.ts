import { regexp } from '@betterer/regexp';
import { eslint } from '@betterer/eslint';

export default {
  'no enzyme tests': () => regexp(/from 'enzyme'/g).include('**/*.test.*'),
  'better eslint': () =>
    eslint({
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        {
          assertionStyle: 'never',
        },
      ],
    }).include('**/*.{ts,tsx}'),
};
