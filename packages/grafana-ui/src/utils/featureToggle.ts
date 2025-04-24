// UPDATING TOGGLE LIST
// Add or remove feature toggles from UIToggles
// The type must be boolean.
interface UIToggles {
  localeFormatPreference: boolean;
}
type ToggleName = keyof UIToggles;

let toggles: Partial<UIToggles> = {};

/**
 * Sets the enabled featureToggle values.
 * @param featureToggles Argument must be empty to reset to defaults or must exactly match UIToggles interface.
 */
export function setFeatureToggles(featureToggles?: ToggleName extends never ? never : Partial<UIToggles>) {
  toggles = featureToggles ?? {};
}

/**
 * Check a featureToggle. If the first argument type is `never`, there are no enabled feature toggles and using the function is intentionally a type error.
 * @param featureName featureToggle name, must be defined in function source file
 * @param def default value if featureToggles aren't defined
 * @returns featureToggle value or def.
 */
export function getFeatureToggle(featureName: ToggleName, def = false) {
  return toggles[featureName] ?? def;
}
