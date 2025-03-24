import { type TransProps, type TransType, type UseTranslateHook } from '../types/i18n';

/**
 * Provides a i18next-compatible translation function.
 */
export let useTranslate: UseTranslateHook = useTranslateDefault;

function useTranslateDefault() {
  // Fallback implementation that should be overridden by setUseT
  const errorMessage = 'useTranslate is not set. useTranslate must not be called before Grafana is initialized.';
  if (process.env.NODE_ENV === 'development') {
    throw new Error(errorMessage);
  }

  console.error(errorMessage);
  return (id: string, defaultMessage: string) => {
    return defaultMessage;
  };
}

export function setUseTranslateHook(hook: UseTranslateHook) {
  useTranslate = hook;
}

let TransComponent: TransType | undefined;

/**
 * Sets the Trans component that will be used for translations throughout the application.
 * This function should only be called once during application initialization.
 *
 * @param transComponent - The Trans component function to use for translations
 * @throws {Error} If called multiple times outside of test environment
 */
export function setTransComponent(transComponent: TransType) {
  // We allow overriding the trans component in tests
  if (TransComponent && process.env.NODE_ENV !== 'test') {
    throw new Error('setTransComponent() function should only be called once, when Grafana is starting.');
  }

  TransComponent = transComponent;
}

/**
 * A React component for handling translations with support for interpolation and pluralization.
 * This component must be initialized using setTransComponent before use.
 *
 * @param props - The translation props including the i18nKey and any interpolation values
 * @returns A React element containing the translated content
 * @throws {Error} If the Trans component hasn't been initialized
 */
export function Trans(props: TransProps): React.ReactElement {
  if (!TransComponent) {
    throw new Error('Trans component not set. Use setTransComponent to set the Trans component.');
  }

  return <TransComponent {...props} />;
}
