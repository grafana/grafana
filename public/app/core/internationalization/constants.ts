type LocaleIdentifier = `${string}-${string}`;

export const ENGLISH_US: LocaleIdentifier = 'en-US';
export const FRENCH_FRANCE: LocaleIdentifier = 'fr-FR';
export const SPANISH_SPAIN: LocaleIdentifier = 'es-ES';

export const DEFAULT_LOCALE: LocaleIdentifier = ENGLISH_US;

export const VALID_LOCALES: LocaleIdentifier[] = [ENGLISH_US, FRENCH_FRANCE, SPANISH_SPAIN];
