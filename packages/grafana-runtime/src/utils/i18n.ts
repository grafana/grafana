type UseTHook = () => (id: string, defaultMessage: string, values?: Record<string, unknown>) => string;

// Fallback implementation that should be overridden by setUseT
export let useT: UseTHook = () => {
  const errorMessage = 'useT is not set. useT must not be called before Grafana is initialized.';
  if (process.env.NODE_ENV === 'development') {
    throw new Error(errorMessage);
  }

  console.error(errorMessage);
  return (id: string, defaultMessage: string) => {
    return defaultMessage;
  };
};

export function setUseTHook(useT: UseTHook) {
  useT = useT;
}
