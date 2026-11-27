import { createRequire } from 'node:module';
import copy from 'rollup-plugin-copy';

import { createPackageConfig } from '../rolldown.config.parts';

const rq = createRequire(import.meta.url);
const icons: string[] = rq('../../public/app/core/icons/cached.json');

const iconSrcPaths = icons.map((iconSubPath) => {
  // eslint-disable-next-line @grafana/no-restricted-img-srcs
  return `../../public/img/icons/${iconSubPath}.svg`;
});

export default createPackageConfig({
  // SVG imports are inlined as markup strings.
  moduleTypes: { '.svg': 'text' },
  plugins: [
    copy({
      targets: [{ src: iconSrcPaths, dest: './dist/public/' }],
      flatten: false,
    }),
  ],
});
