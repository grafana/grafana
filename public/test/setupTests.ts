import '@testing-library/jest-dom';
import failOnConsole from 'jest-fail-on-console';
import { matchers } from './matchers';

failOnConsole({
  shouldFailOnLog: true,
});
expect.extend(matchers);
