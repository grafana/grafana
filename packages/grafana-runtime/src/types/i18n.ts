/**
 * Hook type for translation function that takes an ID, default message, and optional values
 * @returns A function that returns the translated string
 */
type UseTranslateHook = () => (id: string, defaultMessage: string, values?: Record<string, unknown>) => string;

/**
 * Type for children elements in Trans component
 * Can be either React nodes or an object of values
 */
type TransChild = React.ReactNode | Record<string, unknown>;

/**
 * Props interface for the Trans component used for internationalization
 * @param i18nKey - The translation key to look up
 * @param children - Child elements or values to interpolate
 * @param components - React elements to use for interpolation
 * @param count - Count value for pluralization
 * @param string defaults - Default text if translation is not found
 * @param ns - Namespace for the translation key
 * @param shouldUnescape - Whether to unescape HTML entities
 * @param values - Values to interpolate into the translation
 */
interface TransProps {
  i18nKey: string;
  children?: TransChild | readonly TransChild[];
  components?: readonly React.ReactElement[] | { readonly [tagName: string]: React.ReactElement };
  count?: number;
  defaults?: string;
  ns?: string;
  shouldUnescape?: boolean;
  values?: Record<string, unknown>;
}

/**
 * Function declaration for the Trans component
 * @param props - The TransProps object containing translation configuration
 * @returns A React element with translated content
 */
declare function Trans(props: TransProps): React.ReactElement;

/**
 * Type alias for the Trans component
 */
type TransType = typeof Trans;

export type { UseTranslateHook, TransProps, TransType };
