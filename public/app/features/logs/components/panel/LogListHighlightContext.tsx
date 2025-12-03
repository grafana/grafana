import { createContext, ReactNode, useCallback, useContext } from 'react';

import { CustomHighlight } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

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
  const theme = useTheme2();
  const paletteLength = theme.visualization.palette.length;

  const addHighlight = useCallback(
    (text: string) => {
      // If text already exists, remove it first (to re-highlight with next color)
      const filtered = customHighlights.filter((h) => h.text !== text);
      // Auto-assign next color index (cycling through available colors)
      const nextColorIndex = filtered.length % paletteLength;
      onHighlightsChange([...filtered, { text, colorIndex: nextColorIndex }]);
    },
    [customHighlights, onHighlightsChange, paletteLength]
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
