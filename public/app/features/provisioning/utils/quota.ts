import { type Condition } from 'app/api/clients/provisioning/v0alpha1';

export function isQuotaReachedOrExceeded(conditions: Condition[] | undefined, conditionType: string): boolean {
  const condition = conditions?.find((c) => c.type === conditionType);
  return condition?.reason === 'QuotaReached' || condition?.reason === 'QuotaExceeded';
}
