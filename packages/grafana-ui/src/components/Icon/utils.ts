import { IconName, IconSize, IconType } from '../../types/icon';

const alwaysMonoIcons: IconName[] = [
  'grafana',
  'favorite',
  'heart-break',
  'heart',
  'panel-add',
  'library-panel',
  'circle-mono',
  // @PERCONA
  'percona-database',
  'percona-analytics',
  'percona-cluster',
  'percona-cluster-network',
  'percona-cluster-computing',
  'percona-dashboard',
  'percona-kubernetes',
  'percona-summary',
  'percona-add',
  'percona-alert',
  'percona-disk',
  'percona-memory',
  'percona-temperature',
  'percona-cpu',
  'percona-surface',
  'percona-network',
  'percona-process',
  'percona-setting',
  'percona-database-checks',
  'percona-system',
  'percona-nav-overview',
  'percona-nav-summary',
  'percona-nav-logo',
  'percona-database-mysql',
  'percona-database-postgresql',
  'percona-database-mongodb',
  'percona-database-proxysql',
  'percona-database-haproxy',
  'percona-asterisk',
  'pmm-logo',
  'pmm-logo-light',
  'percona-bell',
  'percona-bell-slash',
  'qan-logo',
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

  const grafanaPublicPath = typeof window !== 'undefined' && window.__grafana_public_path__;
  if (grafanaPublicPath) {
    iconRoot = grafanaPublicPath + 'img/icons/';
  } else {
    iconRoot = 'public/img/icons/';
  }

  return iconRoot;
}
