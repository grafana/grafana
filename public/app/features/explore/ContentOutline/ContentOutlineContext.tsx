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

export function ContentOutlineContextProvider({ children }: { children: ReactNode }) {
  const [outlineItems, setOutlineItems] = useState<ContentOutlineItemContextProps[]>([]);
  const parentlessItemsRef = useRef<ParentlessItems>({});

  const register: RegisterFunction = useCallback((outlineItem) => {
    const id = uniqueId(`${outlineItem.panelId}-${outlineItem.title}-${outlineItem.icon}_`);

    setOutlineItems((prevItems) => {
      if (outlineItem.level === 'root') {
        const mergeSingleChild = checkMergeSingleChild(parentlessItemsRef, outlineItem);
        const updatedItems = [
          ...prevItems,
          {
            ...outlineItem,
            id,
            children: parentlessItemsRef.current[outlineItem.panelId] || [],
            mergeSingleChild,
          },
        ];

        return updatedItems.sort(sortElementsByDocumentPosition);
      }

      if (outlineItem.level === 'child') {
        const parentIndex = prevItems.findIndex(
          (item) => item.panelId === outlineItem.panelId && item.level === 'root'
        );
        if (parentIndex === -1) {
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

        const newItems = [...prevItems];
        const parent = { ...newItems[parentIndex] };
        const childrenUpdated = [...(parent.children || []), { ...outlineItem, id }];
        childrenUpdated.sort(sortElementsByDocumentPosition);
        const mergeSingleChild = checkMergeSingleChild(parentlessItemsRef, parent);

        newItems[parentIndex] = {
          ...parent,
          children: childrenUpdated,
          mergeSingleChild,
        };

        return newItems;
      }

      return [...prevItems];
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
}

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

function checkMergeSingleChild(
  parentlessItemsRef: React.MutableRefObject<ParentlessItems>,
  outlineItem: Omit<ContentOutlineItemContextProps, 'id'>
) {
  const children = parentlessItemsRef.current[outlineItem.panelId] || [];
  const mergeSingleChild = children.length === 1 && outlineItem.mergeSingleChild;

  return mergeSingleChild;
}

export function useContentOutlineContext() {
  return useContext(ContentOutlineContext);
}
