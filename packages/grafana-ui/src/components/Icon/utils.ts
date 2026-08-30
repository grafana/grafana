import { type IconName, type IconSize, type IconType } from '../../types/icon';

const alwaysMonoIcons: IconName[] = [
  'grafana',
  'favorite',
  'heart-break',
  'heart',
  'panel-add',
  'library-panel',
  'circle-mono',
];

export function getIconSubDir(name: IconName, type: IconType): string {
  if (name?.startsWith('gf-')) {
    return 'custom';
  } else if (alwaysMonoIcons.includes(name)) {
    return 'mono';
  } else if (type === 'default') {
    return 'unicons';
  } else if (type === 'solid') {
    return 'solid';
  } else {
    return 'mono';
  }
}

/* Transform string with px to number and add 2 pxs as path in svg is 2px smaller */
export function getSvgSize(size: IconSize) {
  switch (size) {
    case 'xs':
      return 12;
    case 'sm':
      return 14;
    case 'md':
      return 16;
    case 'lg':
      return 18;
    case 'xl':
      return 24;
    case 'xxl':
      return 36;
    case 'xxxl':
      return 48;
  }
}

let iconRoot: string | undefined;

export function getIconRoot(): string {
  if (iconRoot) {
    return iconRoot;
  }

  // Read through a window global rather than __webpack_public_path__: in a plugin bundle
  // that resolves to the plugin's public path, not Grafana's.
  const buildPath = typeof window !== 'undefined' && window.__grafana_build_path__;
  if (buildPath) {
    iconRoot = buildPath + 'img/icons/';
  } else {
    // No entry point has run (server-side rendering, unit tests), so assume the default
    // build directory.
    iconRoot = 'public/build/img/icons/';
  }

  return iconRoot;
}

export function getIconPath(name: IconName, type: IconType = 'default'): string {
  const iconRoot = getIconRoot();
  const subDir = getIconSubDir(name, type);
  return `${iconRoot}${subDir}/${name}.svg`;
}
