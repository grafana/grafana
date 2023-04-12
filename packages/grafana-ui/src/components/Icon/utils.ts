import { IconName, IconSize } from '../../types/icon';

const alwaysMonoIcons: IconName[] = [
  'grafana',
  'favorite',
  'heart-break',
  'heart',
  'panel-add',
  'library-panel',
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
  'percona-database-mysql',
  'percona-database-postgresql',
  'percona-database-mongodb',
  'percona-database-proxysql',
  'percona-database-haproxy',
  'percona-asterisk',
  'pmm-logo',
  'qan-logo',
];

export function getIconSubDir(name: IconName, type: string): string {
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
