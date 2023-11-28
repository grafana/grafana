import React, { useEffect, useState } from 'react';
import store from '../../store';
export const LocalStorageValueProvider = (props) => {
    const { children, storageKey, defaultValue } = props;
    const [state, setState] = useState({ value: store.getObject(props.storageKey, props.defaultValue) });
    useEffect(() => {
        const onStorageUpdate = (v) => {
            if (v.key === storageKey) {
                setState({ value: store.getObject(props.storageKey, props.defaultValue) });
            }
        };
        window.addEventListener('storage', onStorageUpdate);
        return () => {
            window.removeEventListener('storage', onStorageUpdate);
        };
    });
    const onSaveToStore = (value) => {
        try {
            store.setObject(storageKey, value);
        }
        catch (error) {
            console.error(error);
        }
        setState({ value });
    };
    const onDeleteFromStore = () => {
        try {
            store.delete(storageKey);
        }
        catch (error) {
            console.log(error);
        }
        setState({ value: defaultValue });
    };
    return React.createElement(React.Fragment, null, children(state.value, onSaveToStore, onDeleteFromStore));
};
//# sourceMappingURL=LocalStorageValueProvider.js.map