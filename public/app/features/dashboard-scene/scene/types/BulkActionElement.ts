import { type EditActionSource, type EditableDashboardElement } from './EditableDashboardElement';

export interface BulkActionElement extends EditableDashboardElement {
  /**
   * Called when the element should be deleted
   */
  onDelete(source?: EditActionSource): void;

  /**
   * Called when the element should be copied
   */
  onCopy?(): void;
}

export function isBulkActionElement(obj: object): obj is BulkActionElement {
  return 'onDelete' in obj;
}
