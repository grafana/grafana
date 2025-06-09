import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

export interface LogListSearchContextData {
  hideSearch: () => void;
  matchingUids: string[] | null;
  search?: string;
  searchVisible?: boolean;
  setMatchingUids: (matches: string[] | null) => void;
  setSearch: (search: string | undefined) => void;
  showSearch: () => void;
}

export const LogListSearchContext = createContext<LogListSearchContextData>({
  hideSearch: () => {},
  matchingUids: null,
  searchVisible: false,
  setMatchingUids: () => {},
  setSearch: () => {},
  showSearch: () => {},
});

export const useLogListSearchContextData = (key: keyof LogListSearchContextData) => {
  const data: LogListSearchContextData = useContext(LogListSearchContext);
  return data[key];
};

export const useLogListSearchContext = (): LogListSearchContextData => {
  return useContext(LogListSearchContext);
};

export const LogListSearchContextProvider = ({ children }: { children: ReactNode }) => {
  const [search, setSearch] = useState<string | undefined>(undefined);
  const [searchVisible, setSearchVisible] = useState(false);
  const [matchingUids, setMatchingUids] = useState<string[] | null>(null);

  const showSearch = useCallback(() => {
    setSearchVisible(true);
  }, []);

  const hideSearch = useCallback(() => {
    setSearchVisible(false);
  }, []);

  return (
    <LogListSearchContext.Provider
      value={{
        hideSearch,
        matchingUids,
        search,
        searchVisible,
        setMatchingUids,
        setSearch,
        showSearch,
      }}
    >
      {children}
    </LogListSearchContext.Provider>
  );
};
