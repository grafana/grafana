import { Chance } from 'chance';

// @todo: replace barrel import path
import { MigrateDataResponseItemDto } from '../api/index';

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
