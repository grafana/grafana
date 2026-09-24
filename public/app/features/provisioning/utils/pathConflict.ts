import { type Condition } from 'app/api/clients/provisioning/v0alpha1';

/** Returns the repository's PathConflict condition, if it's currently reporting a conflict. */
export function getPathConflictCondition(conditions: Condition[] | undefined): Condition | undefined {
  const condition = conditions?.find((c) => c.type === 'PathConflict');
  return condition?.reason === 'PathConflict' ? condition : undefined;
}
