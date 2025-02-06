export interface BulkActionElement {
  onDelete(): void;
  onCopy?(): void;
}

export function isBulkActionElement(obj: object): obj is BulkActionElement {
  return 'onDelete' in obj;
}
