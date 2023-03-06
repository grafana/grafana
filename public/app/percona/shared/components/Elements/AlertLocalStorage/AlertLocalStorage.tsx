import React, { ReactNode, useEffect, useState } from 'react';

import { Alert } from '@grafana/ui';

import { DAY_IN_MS } from './AlertLocalStorage.constants';

interface AlertLocalStorageProps {
  uniqueName: string;
  title: string;
  customButtonContent: ReactNode;
  onCustomButtonClick: () => void;
  children: ReactNode;
}

export const AlertLocalStorage = ({
  uniqueName,
  title,
  children,
  customButtonContent,
  onCustomButtonClick,
}: AlertLocalStorageProps) => {
  const [showAlert, setShowAlert] = useState(true);

  const setToLocalStorage = (keyName: string, keyValue: boolean, ttlInDays: number) => {
    const data = {
      value: keyValue,
      ttl: Date.now() + ttlInDays * DAY_IN_MS,
    };

    localStorage.setItem(keyName, JSON.stringify(data));
  };

  const getFromLocalStorage = (keyName: string) => {
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
    } else {
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

  return (
    <Alert
      title={title}
      severity="info"
      customButtonContent={customButtonContent}
      onCustomButtonClick={onCustomButtonClick}
      onRemove={handleCloseAlert}
    >
      {children}
    </Alert>
  );
};
