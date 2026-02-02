import { Permission, PermissionGroup } from './types';

export const rawToPermissionGroup = (permissions: Permission[]): PermissionGroup => {
  const weight = [
    'Dashboards',
    'Folders',
    'Datasources',
    'Calculated fields',
    'Reports',
    'Administration',
    'Service management query types',
    'Insight Finder'
  ];
  const group: PermissionGroup = permissions.reduce((prev, curr: Permission) => {
    if (!prev[curr.group]) {
      prev[curr.group] = [];
    }
    prev[curr.group].push(curr);
    return prev;
  }, {} as PermissionGroup);

  // sort the keys based on the order
  const ordered: PermissionGroup = {};
  weight.forEach((key) => {
    if (group[key]) {
      ordered[key] = group[key];
    }
  });
  return ordered;
};

export const orderPermissions = (permissions: Permission[]): Permission[] => {
  const weight = [':access', ':read', ':create', ':download'];

  return permissions.sort((a, b) => {
    const aWeight = weight.findIndex((w) => a.name.includes(w));
    const bWeight = weight.findIndex((w) => b.name.includes(w));

    if (aWeight === -1 && bWeight === -1) {
      return a.name.localeCompare(b.name);
    }

    if (aWeight === -1) {
      return 1;
    }

    if (bWeight === -1) {
      return -1;
    }

    return aWeight - bWeight;
  });
};
