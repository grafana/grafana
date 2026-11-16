import copy from 'rollup-plugin-copy';

import { createPackageConfig } from '../rolldown.config.parts';

export default createPackageConfig({
  plugins: [
    copy({
      targets: [
        {
          src: 'src/themes/schema.generated.json',
          dest: 'dist/esm/',
        },
        {
          src: 'src/themes/themeDefinitions/*.json',
          dest: 'dist/esm/',
        },
      ],
      flatten: false,
    }),
  ],
});
