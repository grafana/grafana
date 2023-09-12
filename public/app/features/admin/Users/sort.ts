import { SortByFn } from '@grafana/ui';
import { UserDTO } from 'app/types';

/**
 * Create a function that sorts by a given key, with the following rules:
 * - If the value is a number, sorts by number
 * - If the value is a string, sorts by date if it can be parsed as a date
 * - If the value is a boolean, sorts by boolean
 * - Otherwise, sorts by string
 */
export const createSortFn =
  (key: keyof UserDTO): SortByFn<UserDTO> =>
  (a, b) => {
    const aValue = a.original[key];
    const bValue = b.original[key];
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return aValue - bValue;
    } else if (
      typeof aValue === 'string' &&
      typeof bValue === 'string' &&
      !Number.isNaN(Date.parse(aValue)) &&
      !Number.isNaN(Date.parse(bValue))
    ) {
      return new Date(aValue).getTime() - new Date(bValue).getTime();
    } else if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
      return aValue === bValue ? 0 : aValue ? -1 : 1;
    }
    return a.original.login.localeCompare(b.original.login);
  };
