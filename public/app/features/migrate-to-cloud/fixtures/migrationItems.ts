import { Chance } from 'chance';

import { MigrateDataResponseItemDto } from '../api';

export function wellFormedDatasourceMigrationItem(
  seed = 1,
  partial: Partial<MigrateDataResponseItemDto> = {}
): MigrateDataResponseItemDto {
  const random = Chance(seed);

  return {
    type: 'DATASOURCE',
    refId: random.guid(),
    status: random.pickone(['OK', 'ERROR']),
    ...partial,
  };
}

export function wellFormedDashboardMigrationItem(
  seed = 1,
  partial: Partial<MigrateDataResponseItemDto> = {}
): MigrateDataResponseItemDto {
  const random = Chance(seed);

  return {
    type: 'DASHBOARD',
    refId: random.guid(),
    status: random.pickone(['OK', 'ERROR']),
    ...partial,
  };
}

export function wellFormedLibraryElementMigrationItem(
  seed = 1,
  partial: Partial<MigrateDataResponseItemDto> = {}
): MigrateDataResponseItemDto {
  const random = Chance(seed);

  return {
    type: 'LIBRARY_ELEMENT',
    refId: random.guid(),
    status: random.pickone(['OK', 'ERROR']),
    ...partial,
  };
}
