import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

export interface LogListSearchContextData {
  hideSearch: () => void;
  search?: string;
  searchVisible?: boolean;
  setSearch: (search: string | undefined) => void;
  showSearch: () => void;
}

export const LogListSearchContext = createContext<LogListSearchContextData>({
  hideSearch: () => {},
  searchVisible: false,
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
        search,
        searchVisible,
        setSearch,
        showSearch,
      }}
    >
      {children}
    </LogListSearchContext.Provider>
  );
};
