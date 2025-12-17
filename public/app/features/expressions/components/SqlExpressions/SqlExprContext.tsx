import { createContext, useContext, ReactNode } from 'react';

interface SqlExprContextValue {
  // Explanations
  explanation: string;
  isExplanationOpen: boolean;
  shouldShowViewExplanation: boolean;
  handleExplain: (explanation: string) => void;
  handleOpenExplanation: () => void;
  handleCloseExplanation: () => void;

  // Suggestions
  suggestions: string[];
  isDrawerOpen: boolean;
  handleHistoryUpdate: (suggestions: string[]) => void;
  handleApplySuggestion: (suggestion: string) => string;
  handleOpenDrawer: () => void;
  handleCloseDrawer: () => void;
}

const SqlExprContext = createContext<SqlExprContextValue | null>(null);

export const useSqlExprContext = () => {
  const context = useContext(SqlExprContext);
  if (!context) {
    throw new Error('useSqlExprContext must be used within SqlExprProvider');
  }
  return context;
};

interface SqlExprProviderProps {
  children: ReactNode;
  value: SqlExprContextValue;
}

export const SqlExprProvider = ({ children, value }: SqlExprProviderProps) => {
  return <SqlExprContext.Provider value={value}>{children}</SqlExprContext.Provider>;
};
