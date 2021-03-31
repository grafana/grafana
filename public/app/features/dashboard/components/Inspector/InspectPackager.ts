import { CollectorItem } from './InspectCollector';

export interface Packager {
  package: (items: CollectorItem[]) => void;
}

export class InspectPackager implements Packager {
  package(items: CollectorItem[]): void {}
}
