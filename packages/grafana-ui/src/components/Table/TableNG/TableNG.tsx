import { LegacyTableNG } from './legacy/LegacyTableNG';
import { RefactoredTableNG } from './refactored/RefactoredTableNG';
import { type TableNGProps } from './types';

/**
 * Dispatches between the legacy monolithic implementation and the refactored flat/nested
 * split. The boolean is threaded from TablePanel via the `table.refactorNested` OpenFeature
 * flag (React-only, so it is not on config.featureToggles and must arrive as a prop).
 */
export function TableNG(props: TableNGProps) {
  return props.nestedRefactorEnabled ? <RefactoredTableNG {...props} /> : <LegacyTableNG {...props} />;
}
