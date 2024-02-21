import React, { useEffect, useState } from 'react';

import store from '../../store';

export interface Props<T> {
  storageKey: string;
  defaultValue: T;
  children: (value: T, onSaveToStore: (value: T) => void, onDeleteFromStore: () => void) => React.ReactNode;
}

export const LocalStorageValueProvider = <T,>(props: Props<T>) => {
  const { children, storageKey, defaultValue } = props;

  const [state, setState] = useState({ value: store.getObject(props.storageKey, props.defaultValue) });

  useEffect(() => {
    const onStorageUpdate = (v: StorageEvent) => {
      if (v.key === storageKey) {
        setState({ value: store.getObject(props.storageKey, props.defaultValue) });
      }
    };

    window.addEventListener('storage', onStorageUpdate);

    return () => {
      window.removeEventListener('storage', onStorageUpdate);
    };
  });

  const onSaveToStore = (value: T) => {
    try {
      store.setObject(storageKey, value);
    } catch (error) {
      console.error(error);
    }
    setState({ value });
  };

  const onDeleteFromStore = () => {
    try {
      store.delete(storageKey);
    } catch (error) {
      console.log(error);
    }
    setState({ value: defaultValue });
  };

  return <>{children(state.value, onSaveToStore, onDeleteFromStore)}</>;
};
