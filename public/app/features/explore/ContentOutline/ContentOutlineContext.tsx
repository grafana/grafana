import { uniqueId } from 'lodash';
import React, { useState, useContext, createContext, ReactNode, useCallback } from 'react';

import { ContentOutlineItemBaseProps } from './ContentOutlineItem';

export interface ContentOutlineItemContextProps extends ContentOutlineItemBaseProps {
  id: string;
  ref: HTMLElement | null;
}

type RegisterFunction = ({ title, icon, ref, displayOrderId }: Omit<ContentOutlineItemContextProps, 'id'>) => string;

interface ContentOutlineContextProps {
  outlineItems: ContentOutlineItemContextProps[];
  register: RegisterFunction;
  unregister: (id: string) => void;
}

const ContentOutlineContext = createContext<ContentOutlineContextProps | undefined>(undefined);

export const ContentOutlineContextProvider = ({ children }: { children: ReactNode }) => {
  const [outlineItems, setOutlineItems] = useState<ContentOutlineItemContextProps[]>([]);

  const register: RegisterFunction = useCallback(({ title, icon, ref, displayOrderId }) => {
    const id = uniqueId(`${title}-${icon}_`);

    setOutlineItems((prevItems) => {
      const updatedItems = [...prevItems, { id, title, icon, ref, displayOrderId }];

      const shouldSort = updatedItems.every((item) => item.displayOrderId !== undefined);

      if (shouldSort) {
        return updatedItems.sort((a, b) => a.displayOrderId! - b.displayOrderId!);
      }

      return updatedItems;
    });

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
  const ctx = useContext(ContentOutlineContext);

  if (!ctx) {
    throw new Error('useContentOutlineContext must be used within a ContentOutlineContextProvider');
  }
  return ctx;
}
