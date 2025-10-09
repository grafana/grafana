/**
 * Type guard functions for runtime type checking
 *
 * These functions provide safe runtime type checking for the plugin data structures,
 * helping to ensure type safety when processing dynamic data from the plugin system.
 */

// Type guard helpers
export function hasExtensionPointsProperty(obj: unknown): obj is { extensionPoints: unknown[] } {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'extensionPoints' in obj &&
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    Array.isArray((obj as unknown as Record<string, unknown>).extensionPoints)
  );
}

export function hasAddedLinksProperty(obj: unknown): obj is { addedLinks: unknown[] } {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'addedLinks' in obj &&
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    Array.isArray((obj as unknown as Record<string, unknown>).addedLinks)
  );
}

export function hasAddedComponentsProperty(obj: unknown): obj is { addedComponents: unknown[] } {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'addedComponents' in obj &&
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    Array.isArray((obj as unknown as Record<string, unknown>).addedComponents)
  );
}

export function hasAddedFunctionsProperty(obj: unknown): obj is { addedFunctions: unknown[] } {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'addedFunctions' in obj &&
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    Array.isArray((obj as unknown as Record<string, unknown>).addedFunctions)
  );
}

export function hasDescriptionProperty(obj: unknown): obj is { description: string } {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'description' in obj &&
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    typeof (obj as unknown as Record<string, unknown>).description === 'string'
  );
}

export function isExtensionPointObject(
  obj: unknown
): obj is { id: string; title?: string; description?: string; definingPlugin?: string } {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'id' in obj &&
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    typeof (obj as unknown as Record<string, unknown>).id === 'string'
  );
}

export function isExtensionObject(
  obj: unknown
): obj is { targets?: string | string[]; id?: string; title?: string; description?: string } {
  return obj !== null && typeof obj === 'object';
}
