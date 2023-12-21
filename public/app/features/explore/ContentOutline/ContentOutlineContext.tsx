import { uniqueId } from 'lodash';
import React, { useState, useContext, createContext, ReactNode, useCallback } from 'react';

import { ContentOutlineItemBaseProps } from './ContentOutlineItem';

export interface ContentOutlineItemContextProps extends ContentOutlineItemBaseProps {
  id: string;
  ref: HTMLElement | null;
  children?: ContentOutlineItemContextProps[];
}

type RegisterFunction = ({ title, icon, ref }: Omit<ContentOutlineItemContextProps, 'id'>) => string;

interface ContentOutlineContextProps {
  outlineItems: ContentOutlineItemContextProps[];
  register: RegisterFunction;
  unregister: (id: string) => void;
}

const ContentOutlineContext = createContext<ContentOutlineContextProps | undefined>(undefined);

export const ContentOutlineContextProvider = ({ children }: { children: ReactNode }) => {
  const [outlineItems, setOutlineItems] = useState<ContentOutlineItemContextProps[]>([]);

  const register: RegisterFunction = useCallback(({ panelId, title, icon, ref }) => {
    const id = uniqueId(`${panelId}-${title}-${icon}_`);

    setOutlineItems((prevItems) => {
      const matchIndex = prevItems.findIndex((item) => item.panelId === panelId);
      const match = prevItems[matchIndex];

      const matchIsParent = match && match.children && match.children.length > 0;

      let updatedItems = [...prevItems];

      if (matchIsParent) {
        match.children?.push({ id, panelId, title, icon, ref });
        match.children?.sort(sortElementsByDocumentPosition);
      } else if (match) {
        const parent = {
          ...match,
          id: uniqueId(`section-${panelId}-${title}-${icon}_`),
          title: panelId,
          children: [match, { id, panelId, title, icon, ref }],
        };
        parent.children.sort(sortElementsByDocumentPosition);
        updatedItems.splice(matchIndex, 1, parent);
      } else {
        updatedItems = [...prevItems, { id, panelId, title, icon, ref }];
        updatedItems.sort(sortElementsByDocumentPosition);
      }

      return updatedItems;
    });

    return id;
  }, []);

  const unregister = useCallback((id: string) => {
    setOutlineItems((prevItems) =>
      prevItems
        .filter((item) => item.id !== id)
        .map((item) => {
          if (item.children) {
            item.children = item.children.filter((child) => child.id !== id);
          }
          return item;
        })
    );
  }, []);

  return (
    <ContentOutlineContext.Provider value={{ outlineItems, register, unregister }}>
      {children}
    </ContentOutlineContext.Provider>
  );
};

function sortElementsByDocumentPosition(a: ContentOutlineItemContextProps, b: ContentOutlineItemContextProps) {
  if (a.ref && b.ref) {
    const diff = a.ref.compareDocumentPosition(b.ref);
    if (diff === Node.DOCUMENT_POSITION_PRECEDING) {
      return 1;
    } else if (diff === Node.DOCUMENT_POSITION_FOLLOWING) {
      return -1;
    }
  }
  return 0;
}

export function useContentOutlineContext() {
  const ctx = useContext(ContentOutlineContext);

  if (!ctx) {
    throw new Error('useContentOutlineContext must be used within a ContentOutlineContextProvider');
  }
  return ctx;
}
