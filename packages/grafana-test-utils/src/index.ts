/**
 * Package containing testing utilities for Grafana, including test render helpers
 * and mock API using MSW.
 *
 * @packageDocumentation
 */

// This is also exported as `@grafana/test-utils/matchers` but we cannot use that in places
// where the tsconfig is not set to moduleResolution: bundler so we export it here also.
export { matchers } from './matchers';
