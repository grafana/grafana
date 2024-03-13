import { uniqueId } from 'lodash';
import React, { useState, useContext, createContext, ReactNode, useCallback, useRef } from 'react';

import { ContentOutlineItemBaseProps } from './ContentOutlineItem';

export interface ContentOutlineItemContextProps extends ContentOutlineItemBaseProps {
  id: string;
  ref: HTMLElement | null;
  children?: ContentOutlineItemContextProps[];
}

type RegisterFunction = (outlineItem: Omit<ContentOutlineItemContextProps, 'id'>) => string;

export interface ContentOutlineContextProps {
  outlineItems: ContentOutlineItemContextProps[];
  register: RegisterFunction;
  unregister: (id: string) => void;
}

interface ParentlessItems {
  [panelId: string]: ContentOutlineItemContextProps[];
}

const ContentOutlineContext = createContext<ContentOutlineContextProps | undefined>(undefined);

export const ContentOutlineContextProvider = ({ children }: { children: ReactNode }) => {
  const [outlineItems, setOutlineItems] = useState<ContentOutlineItemContextProps[]>([]);
  const parentlessItemsRef = useRef<ParentlessItems>({});

  const register: RegisterFunction = useCallback((outlineItem) => {
    const id = uniqueId(`${outlineItem.panelId}-${outlineItem.title}-${outlineItem.icon}_`);

    setOutlineItems((prevItems) => {
      if (outlineItem.level === 'root') {
        return [
          ...prevItems,
          {
            ...outlineItem,
            id,
            children: parentlessItemsRef.current[outlineItem.panelId] || [],
          },
        ];
      }

      if (outlineItem.level === 'child') {
        const parent = prevItems.find((item) => item.panelId === outlineItem.panelId && item.level === 'root');
        if (!parent) {
          const parentlessItemSibling = Object.keys(parentlessItemsRef.current).find(
            (key) => key === outlineItem.panelId
          );

          if (parentlessItemSibling) {
            parentlessItemsRef.current[outlineItem.panelId].push({
              ...outlineItem,
              id,
            });
          } else {
            parentlessItemsRef.current[outlineItem.panelId] = [
              {
                ...outlineItem,
                id,
              },
            ];
          }
          return [...prevItems];
        }

        parent.children?.push({
          ...outlineItem,
          id,
        });
        parent.children?.sort(sortElementsByDocumentPosition);

        return [...prevItems];
      }

      return prevItems;
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

  return ctx;
}
