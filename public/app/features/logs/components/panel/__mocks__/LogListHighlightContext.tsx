import { ReactNode } from 'react';

import { CustomHighlight } from '@grafana/data';

import {
  LogListHighlightContext,
  type LogListHighlightContextData,
  useLogListHighlightContext,
} from '../LogListHighlightContext';

// Re-export for tests that import from the mock
export { LogListHighlightContext, useLogListHighlightContext };
export type { LogListHighlightContextData };

export const defaultValue: LogListHighlightContextData = {
  customHighlights: [],
  addHighlight: jest.fn(),
  resetHighlights: jest.fn(),
  hasHighlights: false,
};

interface LogListHighlightContextProviderProps {
  children: ReactNode;
  customHighlights?: CustomHighlight[];
  onHighlightsChange?: (highlights: CustomHighlight[]) => void;
}

export const LogListHighlightContextProvider = ({
  children,
  customHighlights = [],
  onHighlightsChange,
}: LogListHighlightContextProviderProps) => {
  return (
    <LogListHighlightContext.Provider
      value={{
        customHighlights,
        addHighlight: onHighlightsChange !== undefined ? jest.fn() : defaultValue.addHighlight,
        resetHighlights: onHighlightsChange !== undefined ? jest.fn() : defaultValue.resetHighlights,
        hasHighlights: customHighlights.length > 0,
      }}
    >
      {children}
    </LogListHighlightContext.Provider>
  );
};
