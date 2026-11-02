import { BusEventBase } from '@grafana/data';

/** Extracted to its own module to avoid a circular dependency through NotebookScene. */
export class NotebookDeletedEvent extends BusEventBase {
  static type = 'notebook-deleted';
}
