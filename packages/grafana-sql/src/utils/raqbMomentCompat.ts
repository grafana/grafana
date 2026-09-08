import { momentCompat } from '@grafana/data/unstable';

/**
 * moment-compatible entry point for `@react-awesome-query-builder`, backed by the luxon compat
 * layer in `@grafana/data` instead of the real moment library.
 *
 * Plugin builds substitute this module for RAQB's `import moment from 'moment'` (see the moment
 * externals handling and `moment$` resolve alias in the `@grafana/plugin-configs` webpack config),
 * so loading a SQL datasource plugin no longer pulls the real moment bundle in at runtime.
 *
 * RAQB only uses a small slice of the moment API, all of which the compat layer provides: parsing
 * with a format string, `utc()`, `ISO_8601`, `locale()`, and instance methods such as `format()`,
 * `isValid()`, `startOf()`, `add()`, `isSame()`, and the `year()`/`month()`/`date()` getters.
 */
export default momentCompat;
