/**
 * Validates if a locale string is valid for use with Intl APIs
 * @param locale - The locale string to validate
 * @returns true if the locale is valid, false otherwise
 */
export function isValidLocale(locale: string): boolean {
  if (!locale || typeof locale !== 'string') {
    return false;
  }
  
  // Check if the locale is a valid BCP 47 language tag
  // This regex pattern validates basic BCP 47 format
  const bcp47Pattern = /^[a-z]{2,3}(-[A-Z]{2,3})?(-[A-Z0-9]{1,8})*$/;
  
  if (!bcp47Pattern.test(locale)) {
    return false;
  }
  
  // Additional check: try to create a DateTimeFormat to see if it's actually supported
  try {
    new Intl.DateTimeFormat(locale);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitizes a locale string by filtering out invalid locales and providing fallbacks
 * @param locales - Array of locale strings to sanitize
 * @param fallback - Fallback locale to use if no valid locales are found
 * @returns Array of valid locales with fallback if needed
 */
export function sanitizeLocales(locales: string[], fallback: string = 'en-US'): string[] {
  if (!Array.isArray(locales)) {
    return [fallback];
  }
  
  const validLocales = locales.filter(locale => isValidLocale(locale));
  
  // If no valid locales found, return fallback
  if (validLocales.length === 0) {
    return [fallback];
  }
  
  return validLocales;
}

/**
 * Gets a safe locale from navigator.languages with fallback
 * @param fallback - Fallback locale to use if navigator.languages is invalid
 * @returns Array of valid locales
 */
export function getSafeNavigatorLocales(fallback: string = 'en-US'): string[] {
  if (typeof navigator === 'undefined' || !navigator.languages) {
    return [fallback];
  }
  
  return sanitizeLocales([...navigator.languages], fallback);
}

/**
 * Creates a safe DateTimeFormat instance with fallback handling
 * @param locales - Array of locale strings
 * @param options - DateTimeFormat options
 * @param fallback - Fallback locale if all provided locales are invalid
 * @returns DateTimeFormat instance
 */
export function createSafeDateTimeFormat(
  locales: string[] | string | undefined,
  options?: Intl.DateTimeFormatOptions,
  fallback: string = 'en-US'
): Intl.DateTimeFormat {
  let safeLocales: string[];
  
  if (Array.isArray(locales)) {
    safeLocales = sanitizeLocales(locales, fallback);
  } else if (typeof locales === 'string') {
    safeLocales = isValidLocale(locales) ? [locales] : [fallback];
  } else {
    safeLocales = [fallback];
  }
  
  try {
    return new Intl.DateTimeFormat(safeLocales, options);
  } catch {
    // Final fallback if even the sanitized locales fail
    return new Intl.DateTimeFormat(fallback, options);
  }
}
