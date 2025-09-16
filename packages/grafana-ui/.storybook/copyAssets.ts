// This script is used to copy assets from the public folder to a temporary static folder within
// the .storybook directory.
// We selectively limit assets that are uploaded to the Storybook bucket to prevent rate limiting
// when publishing new storybook.
// Note: Storybook has a static copying feature but it copies entire directories which can contain thousands of icons.

import { existsSync, copySync, lstatSync } from 'fs-extra';
import { resolve } from 'node:path';

// avoid importing from @grafana/data to prevent error: window is not defined
import { availableIconsIndex, IconName } from '../../grafana-data/src/types/icon';
import { getIconSubDir } from '../src/components/Icon/utils';

// doesn't require uploading 1000s of unused assets.
const iconPaths = Object.keys(availableIconsIndex)
  .filter((iconName) => !iconName.startsWith('fa '))
  .map((iconName) => {
    const subDir = getIconSubDir(iconName as IconName, 'default');
    return {
      from: `../../../public/img/icons/${subDir}/${iconName}.svg`,
      to: `./static/public/build/img/icons/${subDir}/${iconName}.svg`,
    };
  });

export function copyAssetsSync() {
  const assets = [
    {
      from: '../../../public/fonts',
      to: './static/public/fonts',
    },
    {
      from: '../../../public/img/grafana_text_logo-dark.svg',
      to: './static/public/img/grafana_text_logo-dark.svg',
    },
    {
      from: '../../../public/img/grafana_text_logo-light.svg',
      to: './static/public/img/grafana_text_logo-light.svg',
    },
    {
      from: '../../../public/img/fav32.png',
      to: './static/public/img/fav32.png',
    },
    {
      from: '../../../public/lib',
      to: './static/public/lib',
    },
    ...iconPaths,
    // copy over the MSW mock service worker so we can mock requests in Storybook
    {
      from: '../../../public/mockServiceWorker.js',
      to: './static/mockServiceWorker.js',
    },
  ];

  for (const asset of assets) {
    const fromPath = resolve(__dirname, asset.from);
    const toPath = resolve(__dirname, asset.to);
    if (!existsSync(toPath)) {
      copySync(fromPath, toPath, {
        filter: (src) => !lstatSync(src).isSymbolicLink(),
      });
    }
  }
}
