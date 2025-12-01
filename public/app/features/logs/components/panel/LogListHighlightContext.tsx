import { createContext, ReactNode, useCallback, useContext } from 'react';

import { CustomHighlight } from '@grafana/data';

export interface LogListHighlightContextData {
  customHighlights: CustomHighlight[];
  addHighlight: (text: string) => void;
  resetHighlights: () => void;
  hasHighlights: boolean;
}

export const LogListHighlightContext = createContext<LogListHighlightContextData>({
  customHighlights: [],
  addHighlight: () => {},
  resetHighlights: () => {},
  hasHighlights: false,
});

export const useLogListHighlightContext = (): LogListHighlightContextData => {
  return useContext(LogListHighlightContext);
};

// Using full theme palette length (50+ colors) - the modulo operation will cycle through all available colors
const HIGHLIGHT_COLOR_COUNT = 50;

interface LogListHighlightContextProviderProps {
  children: ReactNode;
  customHighlights: CustomHighlight[];
  onHighlightsChange: (highlights: CustomHighlight[]) => void;
}

export const LogListHighlightContextProvider = ({
  children,
  customHighlights,
  onHighlightsChange,
}: LogListHighlightContextProviderProps) => {
  const addHighlight = useCallback(
    (text: string) => {
      // If text already exists, remove it first (to re-highlight with next color)
      const filtered = customHighlights.filter((h) => h.text !== text);
      // Auto-assign next color index (cycling through available colors)
      const nextColorIndex = filtered.length % HIGHLIGHT_COLOR_COUNT;
      onHighlightsChange([...filtered, { text, colorIndex: nextColorIndex }]);
    },
    [customHighlights, onHighlightsChange]
  );

  const resetHighlights = useCallback(() => {
    onHighlightsChange([]);
  }, [onHighlightsChange]);

  return (
    <LogListHighlightContext.Provider
      value={{
        customHighlights,
        addHighlight,
        resetHighlights,
        hasHighlights: customHighlights.length > 0,
      }}
    >
      {children}
    </LogListHighlightContext.Provider>
  );
};
