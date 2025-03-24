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
 */
interface TransProps {
  /**
   * The translation key to look up
   */
  i18nKey: string;
  /**
   * Child elements or values to interpolate
   */
  children?: TransChild | readonly TransChild[];
  /**
   * React elements to use for interpolation
   */
  components?: readonly React.ReactElement[] | { readonly [tagName: string]: React.ReactElement };
  /**
   * Count value for pluralization
   */
  count?: number;
  /**
   * Default text if translation is not found
   */
  defaults?: string;
  /**
   * Namespace for the translation key
   */
  ns?: string;
  /**
   * Whether to unescape HTML entities
   */
  shouldUnescape?: boolean;
  /**
   * Values to interpolate into the translation
   */
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
