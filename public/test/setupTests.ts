// `structuredClone` is not yet in jsdom https://github.com/jsdom/jsdom/issues/3363
import 'core-js/stable/structured-clone';
import 'whatwg-fetch';
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import i18next from 'i18next';
import failOnConsole from 'jest-fail-on-console';
import { initReactI18next } from 'react-i18next';

import getEnvConfig from '../../scripts/webpack/env-util';

import { matchers } from './matchers';

const config = getEnvConfig() as Record<string, string | boolean>;

if (config.frontend_dev_fail_tests_on_console || process.env.CI) {
  failOnConsole({
    shouldFailOnLog: true,
    shouldFailOnDebug: true,
    shouldFailOnInfo: true,
  });
}

expect.extend(matchers);

i18next.use(initReactI18next).init({
  resources: {},
  returnEmptyString: false,
  lng: 'en-US', // this should be the locale of the phrases in our source JSX
});

// mock out the worker that detects changes in the dashboard
// The mock is needed because JSDOM does not support workers and
// the factory uses import.meta.url so we can't use it in CommonJS modules.
jest.mock('app/features/dashboard-scene/saving/createDetectChangesWorker.ts');

// our tests are heavy in CI due to parallelisation and monaco and kusto
// so we increase the default timeout to 2secs to avoid flakiness
configure({ asyncUtilTimeout: 2000 });
