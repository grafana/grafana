import { outcomeRegistry } from './outcomeRegistry';
import { visibilityOutcome } from './VisibilityOutcome';

// Initialize the outcome registry with the built-in outcome types.
// New outcome types can be registered elsewhere via outcomeRegistry.register().
outcomeRegistry.setInit(() => [visibilityOutcome]);
