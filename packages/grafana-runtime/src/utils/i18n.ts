type UseTranslateHook = () => (id: string, defaultMessage: string, values?: Record<string, unknown>) => string;

/**
 * Provides a i18next-compatible translation function.
 */
export let useTranslate: UseTranslateHook = () => {
  // Fallback implementation that should be overridden by setUseT
  const errorMessage = 'useTranslate is not set. useTranslate must not be called before Grafana is initialized.';
  if (process.env.NODE_ENV === 'development') {
    throw new Error(errorMessage);
  }

  console.error(errorMessage);
  return (id: string, defaultMessage: string) => {
    return defaultMessage;
  };
};

export function setUseTranslateHook(hook: UseTranslateHook) {
  useTranslate = hook;
}
