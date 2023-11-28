import React, { useEffect, useState } from 'react';
import { Alert } from '@grafana/ui';
import { DAY_IN_MS } from './AlertLocalStorage.constants';
export const AlertLocalStorage = ({ uniqueName, title, children, customButtonContent, onCustomButtonClick, }) => {
    const [showAlert, setShowAlert] = useState(true);
    const setToLocalStorage = (keyName, keyValue, ttlInDays) => {
        const data = {
            value: keyValue,
            ttl: Date.now() + ttlInDays * DAY_IN_MS,
        };
        localStorage.setItem(keyName, JSON.stringify(data));
    };
    const getFromLocalStorage = (keyName) => {
        const data = localStorage.getItem(keyName);
        if (!data) {
            return null;
        }
        const item = JSON.parse(data);
        if (Date.now() > item.ttl) {
            localStorage.removeItem(keyName);
            return null;
        }
        return item.value;
    };
    useEffect(() => {
        const isClosed = getFromLocalStorage(uniqueName);
        if (isClosed) {
            setShowAlert(false);
        }
        else {
            setShowAlert(true);
        }
    }, [uniqueName]);
    const handleCloseAlert = () => {
        setToLocalStorage(uniqueName, true, 7);
        setShowAlert(false);
    };
    if (!showAlert) {
        return null;
    }
    return (React.createElement(Alert, { title: title, severity: "info", customButtonContent: customButtonContent, onCustomButtonClick: onCustomButtonClick, onRemove: handleCloseAlert }, children));
};
//# sourceMappingURL=AlertLocalStorage.js.map