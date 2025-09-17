import { Chance } from 'chance';

import { dateTime } from '@grafana/data';

/**
 * Generates a timestamp string in the format YYYY-MM-DD-xxxxx where xxxxx is a random string
 */
export function generateTimestamp(): string {
  const random = new Chance();
  return `${dateTime().format('YYYY-MM-DD')}-${random.string({ length: 5, alpha: true })}`;
}
