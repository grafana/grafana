import { regexp } from '@betterer/regexp';

export default {
  'no enzyme tests': () => regexp(/from 'enzyme'/g).include('**/*.test.*'),
};
