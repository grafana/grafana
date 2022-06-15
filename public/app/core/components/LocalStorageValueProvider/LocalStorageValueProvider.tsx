import React, { PureComponent } from 'react';

import store from '../../store';

export interface Props<T> {
  storageKey: string;
  defaultValue: T;
  children: (value: T, onSaveToStore: (value: T) => void, onDeleteFromStore: () => void) => React.ReactNode;
}

interface State<T> {
  value: T;
}

export class LocalStorageValueProvider<T> extends PureComponent<Props<T>, State<T>> {
  constructor(props: Props<T>) {
    super(props);

    const { storageKey, defaultValue } = props;

    this.state = {
      value: store.getObject(storageKey, defaultValue),
    };
  }

  onSaveToStore = (value: T) => {
    const { storageKey } = this.props;
    try {
      store.setObject(storageKey, value);
    } catch (error) {
      console.error(error);
    }
    this.setState({ value });
  };

  onDeleteFromStore = () => {
    const { storageKey, defaultValue } = this.props;
    try {
      store.delete(storageKey);
    } catch (error) {
      console.log(error);
    }
    this.setState({ value: defaultValue });
  };

  render() {
    const { children } = this.props;
    const { value } = this.state;

    return <>{children(value, this.onSaveToStore, this.onDeleteFromStore)}</>;
  }
}
