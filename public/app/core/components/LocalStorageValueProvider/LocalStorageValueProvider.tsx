import React, { PureComponent } from 'react';
import store from '../../store';

export interface Props<T> {
  storageKey: string;
  defaultValue?: T;
  children: (value: T, onSaveToStore: (value: T) => void) => React.ReactNode;
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

  render() {
    const { children } = this.props;
    const { value } = this.state;

    return <>{children(value, this.onSaveToStore)}</>;
  }
}
