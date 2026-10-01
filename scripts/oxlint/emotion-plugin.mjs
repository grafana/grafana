// @emotion/eslint-plugin only has named exports, but oxlint loads JS plugins from the default export.
import { rules } from '@emotion/eslint-plugin';

export default { meta: { name: '@emotion' }, rules };
