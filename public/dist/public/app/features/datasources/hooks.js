import { useCallback, useEffect, useRef } from 'react';
import { useLocalStorage } from 'react-use';
import { getDataSourceSrv } from '@grafana/runtime';
export const LOCAL_STORAGE_KEY = 'grafana.features.datasources.components.picker.DataSourceDropDown.history';
/**
 * Stores the uid of the last 5 data sources selected by the user. The last UID is the one most recently used.
 */
export function useRecentlyUsedDataSources() {
    const [value = [], setStorage] = useLocalStorage(LOCAL_STORAGE_KEY, []);
    const pushRecentlyUsedDataSource = useCallback((ds) => {
        if (ds.meta.builtIn) {
            // Prevent storing the built in datasources (-- Grafana --, -- Mixed --,  -- Dashboard --)
            return;
        }
        if (value.includes(ds.uid)) {
            // Prevent storing multiple copies of the same data source, put it at the front of the array instead.
            value.splice(value.findIndex((dsUid) => ds.uid === dsUid), 1);
            setStorage([...value, ds.uid]);
        }
        else {
            setStorage([...value, ds.uid].slice(1, 6));
        }
    }, [value, setStorage]);
    return [value, pushRecentlyUsedDataSource];
}
export function useDatasources(filters) {
    const dataSourceSrv = getDataSourceSrv();
    const dataSources = dataSourceSrv.getList(filters);
    return dataSources;
}
export function useDatasource(dataSource) {
    const dataSourceSrv = getDataSourceSrv();
    if (typeof dataSource === 'string') {
        return dataSourceSrv.getInstanceSettings(dataSource);
    }
    return dataSourceSrv.getInstanceSettings(dataSource);
}
/**
 * Allows navigating lists of elements where the data-role attribute is set to "keyboardSelectableItem"
 * @param props
 */
export function useKeyboardNavigatableList(props) {
    const { keyboardEvents, containerRef } = props;
    const selectedIndex = useRef(0);
    const attributeName = 'data-role';
    const roleName = 'keyboardSelectableItem';
    const navigatableItemProps = Object.assign({ [attributeName]: roleName });
    const querySelectorNavigatableElements = `[${attributeName}="${roleName}"`;
    const selectedAttributeName = 'data-selectedItem';
    const selectedItemCssSelector = `[${selectedAttributeName}="true"]`;
    const selectItem = useCallback((index) => {
        var _a;
        const listItems = (_a = containerRef === null || containerRef === void 0 ? void 0 : containerRef.current) === null || _a === void 0 ? void 0 : _a.querySelectorAll(querySelectorNavigatableElements);
        const selectedItem = listItems === null || listItems === void 0 ? void 0 : listItems.item(index % (listItems === null || listItems === void 0 ? void 0 : listItems.length));
        listItems === null || listItems === void 0 ? void 0 : listItems.forEach((li) => li.setAttribute(selectedAttributeName, 'false'));
        if (selectedItem) {
            selectedItem.scrollIntoView({ block: 'center' });
            selectedItem.setAttribute(selectedAttributeName, 'true');
        }
    }, [containerRef, querySelectorNavigatableElements]);
    const clickSelectedElement = useCallback(() => {
        var _a, _b, _c;
        (_c = (_b = (_a = containerRef === null || containerRef === void 0 ? void 0 : containerRef.current) === null || _a === void 0 ? void 0 : _a.querySelector(selectedItemCssSelector)) === null || _b === void 0 ? void 0 : _b.querySelector('button') // This is a bit weird. The main use for this would be to select card items, however the root of the card component does not have the click event handler, instead it's attached to a button inside it.
        ) === null || _c === void 0 ? void 0 : _c.click();
    }, [containerRef, selectedItemCssSelector]);
    useEffect(() => {
        if (!keyboardEvents) {
            return;
        }
        const sub = keyboardEvents.subscribe({
            next: (keyEvent) => {
                switch (keyEvent === null || keyEvent === void 0 ? void 0 : keyEvent.code) {
                    case 'ArrowDown': {
                        selectItem(++selectedIndex.current);
                        keyEvent.preventDefault();
                        break;
                    }
                    case 'ArrowUp':
                        selectedIndex.current = selectedIndex.current > 0 ? selectedIndex.current - 1 : selectedIndex.current;
                        selectItem(selectedIndex.current);
                        keyEvent.preventDefault();
                        break;
                    case 'Enter':
                        clickSelectedElement();
                        break;
                }
            },
        });
        return () => sub.unsubscribe();
    }, [keyboardEvents, selectItem, clickSelectedElement]);
    useEffect(() => {
        // This observer is used to keep track of the number of items in the list
        // that can change dinamically (e.g. when filtering a dropdown list)
        const listObserver = new MutationObserver((mutations) => {
            const listHasChanged = mutations.some((mutation) => (mutation.addedNodes && mutation.addedNodes.length > 0) ||
                (mutation.removedNodes && mutation.removedNodes.length > 0));
            listHasChanged && selectItem(0);
        });
        if (containerRef.current) {
            listObserver.observe(containerRef.current, {
                childList: true,
            });
        }
        return () => {
            listObserver.disconnect();
        };
    }, [containerRef, querySelectorNavigatableElements, selectItem]);
    return [navigatableItemProps, selectedItemCssSelector];
}
//# sourceMappingURL=hooks.js.map