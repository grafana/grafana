import { dateTime } from '@grafana/data';

/**
 * Generates a timestamp string in the format YYYY-MM-DD-xxxxx where xxxxx is a random string
 */
export function generateTimestamp(): string {
  const randStr = Math.random().toString(36).substring(2, 7);
  return `${dateTime().format('YYYY-MM-DD')}-${randStr}`;
}
