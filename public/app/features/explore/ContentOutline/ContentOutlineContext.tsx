import { uniqueId } from 'lodash';
import React, { useState, useContext, createContext, ReactNode, useCallback } from 'react';

interface OutlineItem {
  id: string;
  title: string;
  icon: string;
  ref: HTMLElement | null;
}

interface ContentOutlineContextProps {
  outlineItems: OutlineItem[];
  register: (title: string, icon: string, ref: HTMLElement | null) => string;
  unregister: (id: string) => void;
}

const ContentOutlineContext = createContext<ContentOutlineContextProps | undefined>(undefined);

export const ContentOutlineContextProvider = ({ children }: { children: ReactNode }) => {
  const [outlineItems, setOutlineItems] = useState<OutlineItem[]>([]);
  console.log('outlineItems', outlineItems);

  const register = useCallback((title: string, icon: string, ref: HTMLElement | null): string => {
    const id = uniqueId(`${title}-${icon}_`);
    setOutlineItems((prevItems) => [...prevItems, { id, title, icon, ref }]);
    return id;
  }, []);

  const unregister = useCallback((id: string) => {
    setOutlineItems((prevItems) => prevItems.filter((item) => item.id !== id));
  }, []);

  return (
    <ContentOutlineContext.Provider value={{ outlineItems, register, unregister }}>
      {children}
    </ContentOutlineContext.Provider>
  );
};

export function useContentOutlineContext() {
  const context = useContext(ContentOutlineContext);
  if (!context) {
    throw new Error('useContentOutlineContext must be used within a ContentOutlineContextProvider');
  }
  return context;
}
