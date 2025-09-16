import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

export interface LogListSearchContextData {
  hideSearch: () => void;
  filterLogs: boolean;
  matchingUids: string[] | null;
  search?: string;
  searchVisible?: boolean;
  setMatchingUids: (matches: string[] | null) => void;
  setSearch: (search: string | undefined) => void;
  showSearch: () => void;
  toggleFilterLogs: () => void;
}

export const LogListSearchContext = createContext<LogListSearchContextData>({
  hideSearch: () => {},
  filterLogs: false,
  matchingUids: null,
  searchVisible: false,
  setMatchingUids: () => {},
  setSearch: () => {},
  showSearch: () => {},
  toggleFilterLogs: () => {},
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
  const [filterLogs, setFilterLogs] = useState(false);

  const hideSearch = useCallback(() => {
    setSearchVisible(false);
  }, []);

  const showSearch = useCallback(() => {
    setSearchVisible(true);
  }, []);

  const toggleFilterLogs = useCallback(() => {
    setFilterLogs((filterLogs) => !filterLogs);
  }, []);

  return (
    <LogListSearchContext.Provider
      value={{
        hideSearch,
        filterLogs,
        matchingUids,
        search,
        searchVisible,
        setMatchingUids,
        setSearch,
        showSearch,
        toggleFilterLogs,
      }}
    >
      {children}
    </LogListSearchContext.Provider>
  );
};
