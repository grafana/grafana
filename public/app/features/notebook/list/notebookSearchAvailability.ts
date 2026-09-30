import { isFetchError } from '@grafana/runtime';

export const NOTEBOOKS_PAGE_LIMIT = 500;

let searchUnavailable = false;
let searchConfirmedAvailable = false;

export function isNotebookSearchUnavailable(): boolean {
  return searchUnavailable;
}

export function confirmNotebookSearchAvailable(): void {
  searchConfirmedAvailable = true;
}

export function markNotebookSearchUnavailable(error: unknown): boolean {
  if (searchConfirmedAvailable || !isFetchError(error) || (error.status !== 404 && error.status !== 405)) {
    return false;
  }
  searchUnavailable = true;
  return true;
}

export function __resetSearchAvailabilityForTests(): void {
  searchUnavailable = false;
  searchConfirmedAvailable = false;
}
