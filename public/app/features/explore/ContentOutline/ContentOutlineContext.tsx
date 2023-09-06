import { uniqueId } from 'lodash';
import React, { useState, useContext, createContext, ReactNode, MutableRefObject } from 'react';

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

  // TODO: implement solution for two panes

  const register = (title: string, icon: string, ref: HTMLElement | null): string => {
    const id = `${title}-${icon}`;
    setOutlineItems((prevItems) => [...prevItems, { id, title, icon, ref }]);
    return id;
  };

  const unregister = (id: string) => {
    setOutlineItems((prevItems) => prevItems.filter((item) => item.id !== id));
  };

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
