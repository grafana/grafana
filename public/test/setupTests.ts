import '@testing-library/jest-dom';
import i18next from 'i18next';
import failOnConsole from 'jest-fail-on-console';
import { initReactI18next } from 'react-i18next';

import { matchers } from './matchers';

failOnConsole({
  shouldFailOnLog: false,
});

expect.extend(matchers);

i18next.use(initReactI18next).init({
  resources: {},
  returnEmptyString: false,
  lng: 'en-US', // this should be the locale of the phrases in our source JSX
});
