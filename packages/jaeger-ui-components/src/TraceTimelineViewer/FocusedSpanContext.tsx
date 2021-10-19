import React, { createContext, useContext, useMemo, useState } from 'react';

export interface FocusedSpanContextValue {
  focusedSpanId?: string;
  setFocusedSpanId: (val?: string) => void;
}

const FocusedSpanContext = createContext<FocusedSpanContextValue | null>(null);

export const FocusedSpanContextProvider: React.FC<{ focusedSpanId?: string }> = ({
  children,
  focusedSpanId: initalValue,
}) => {
  const [focusedSpanId, setFocusedSpanId] = useState(initalValue);

  const value = useMemo(() => ({ focusedSpanId, setFocusedSpanId }), [focusedSpanId, setFocusedSpanId]);

  return <FocusedSpanContext.Provider value={value}>{children}</FocusedSpanContext.Provider>;
};

export const useFocusedSpanContext = () => {
  const ctx = useContext(FocusedSpanContext);
  if (ctx == null) {
    throw new Error('Must provide FocusedSpanContextProvider');
  }
  return ctx;
};

export const withFocusedSpanContext = (
  WrappedComponent: React.ComponentType<{ focusedSpanContext: FocusedSpanContextValue }>
) => {
  const HOC: React.FC = (props) => {
    const context = useFocusedSpanContext();

    return <WrappedComponent focusedSpanContext={context} {...props} />;
  };

  return HOC;
};
