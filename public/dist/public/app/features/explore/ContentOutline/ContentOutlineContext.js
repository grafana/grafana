import { uniqueId } from 'lodash';
import React, { useState, useContext, createContext, useCallback } from 'react';
const ContentOutlineContext = createContext(undefined);
export const ContentOutlineContextProvider = ({ children }) => {
    const [outlineItems, setOutlineItems] = useState([]);
    const register = useCallback(({ title, icon, ref }) => {
        const id = uniqueId(`${title}-${icon}_`);
        setOutlineItems((prevItems) => {
            const updatedItems = [...prevItems, { id, title, icon, ref }];
            return updatedItems.sort((a, b) => {
                if (a.ref && b.ref) {
                    const diff = a.ref.compareDocumentPosition(b.ref);
                    if (diff === Node.DOCUMENT_POSITION_PRECEDING) {
                        return 1;
                    }
                    else if (diff === Node.DOCUMENT_POSITION_FOLLOWING) {
                        return -1;
                    }
                }
                return 0;
            });
        });
        return id;
    }, []);
    const unregister = useCallback((id) => {
        setOutlineItems((prevItems) => prevItems.filter((item) => item.id !== id));
    }, []);
    return (React.createElement(ContentOutlineContext.Provider, { value: { outlineItems, register, unregister } }, children));
};
export function useContentOutlineContext() {
    const ctx = useContext(ContentOutlineContext);
    if (!ctx) {
        throw new Error('useContentOutlineContext must be used within a ContentOutlineContextProvider');
    }
    return ctx;
}
//# sourceMappingURL=ContentOutlineContext.js.map