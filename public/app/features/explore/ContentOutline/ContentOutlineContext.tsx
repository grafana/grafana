import { uniqueId } from 'lodash';
import React, { useState, useContext, createContext, ReactNode, useCallback, useRef, useEffect } from 'react';

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
  updateOutlineItems: (newItems: ContentOutlineItemContextProps[]) => void;
}

interface ContentOutlineContextProviderProps {
  children: ReactNode;
  /**
   * used to resort children of an outline item when the dependencies change
   * e.g. when the order of query rows changes on drag and drop
   */
  refreshDependencies?: unknown[];
}

interface ParentlessItems {
  [panelId: string]: ContentOutlineItemContextProps[];
}

export const ContentOutlineContext = createContext<ContentOutlineContextProps | undefined>(undefined);

export function ContentOutlineContextProvider({ children, refreshDependencies }: ContentOutlineContextProviderProps) {
  const [outlineItems, setOutlineItems] = useState<ContentOutlineItemContextProps[]>([]);
  const parentlessItemsRef = useRef<ParentlessItems>({});

  const register: RegisterFunction = useCallback((outlineItem) => {
    const id = uniqueId(`${outlineItem.panelId}-${outlineItem.title}-${outlineItem.icon}_`);

    setOutlineItems((prevItems) => {
      if (outlineItem.level === 'root') {
        const mergeSingleChild = checkMergeSingleChild(parentlessItemsRef, outlineItem);
        const parentlessItems = parentlessItemsRef.current[outlineItem.panelId] || [];

        // if item has children in parentlessItemsRef and they are filters,
        // modify each child to have ref = outlineItem.ref
        // so that clicking on the filter will also bring the parent item into view
        if (parentlessItems.length > 0) {
          parentlessItemsRef.current[outlineItem.panelId].forEach((item) => {
            if (item.type === 'filter') {
              item.ref = outlineItem.ref;
            }
          });
        }

        // remove children from parentlessItemsRef
        parentlessItemsRef.current[outlineItem.panelId] = [];

        const updatedItems = [
          ...prevItems,
          {
            ...outlineItem,
            id,
            children: parentlessItems,
            mergeSingleChild,
          },
        ];

        return updatedItems.sort(sortElementsByDocumentPosition);
      }

      if (outlineItem.level === 'child') {
        let siblingWithSameTitleFound = false;
        // items with type filter should not have siblings with the same title
        // look at all parentless items and check if there is a sibling with the same title
        Object.keys(parentlessItemsRef.current).forEach((key) => {
          const siblingWithSameTitle = parentlessItemsRef.current[key].find(
            (item) =>
              item.title === outlineItem.title && outlineItem.type === 'filter' && outlineItem.panelId === item.panelId
          );
          if (siblingWithSameTitle) {
            siblingWithSameTitleFound = true;
            return;
          }
        });

        if (siblingWithSameTitleFound) {
          return [...prevItems];
        }

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

        // look at all registered items inside items parent and check if there is
        // a filter sibling with the same title
        const siblingWithSameTitle = parent.children?.find(
          (item) =>
            item.title === outlineItem.title && outlineItem.type === 'filter' && outlineItem.panelId === item.panelId
        );

        if (siblingWithSameTitle) {
          return [...prevItems];
        }

        let ref = outlineItem.ref;
        if (outlineItem.type === 'filter') {
          ref = parent.ref;
        }

        const childrenUpdated = [...(parent.children || []), { ...outlineItem, id, ref }];
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

  const updateOutlineItems = useCallback((newItems: ContentOutlineItemContextProps[]) => {
    setOutlineItems(newItems);
  }, []);

  useEffect(() => {
    setOutlineItems((prevItems) => {
      const newItems = [...prevItems];
      for (const item of newItems) {
        item.children?.sort(sortElementsByDocumentPosition);
      }
      return newItems;
    });
  }, [refreshDependencies]);

  return (
    <ContentOutlineContext.Provider value={{ outlineItems, register, unregister, updateOutlineItems }}>
      {children}
    </ContentOutlineContext.Provider>
  );
}

export function sortElementsByDocumentPosition(a: ContentOutlineItemContextProps, b: ContentOutlineItemContextProps) {
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
