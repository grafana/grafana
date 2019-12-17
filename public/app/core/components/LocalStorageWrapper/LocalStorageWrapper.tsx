import React, { Component } from 'react';
import store from '../../store';

export interface Props<T> {
  storeAtKey: string;
  defaultValue?: T;
  children: (value: T, onSaveToStore: (value: T) => void) => React.ReactNode;
}

interface State<T extends {}> {
  value: T;
}

export default class LocalStorageWrapper<T> extends Component<Props<T>, State<T>> {
  constructor(props: Props<T>) {
    super(props);

    this.state = {
      value: props.defaultValue,
    };
  }

  componentWillMount() {
    const { storeAtKey, defaultValue } = this.props;
    const value = store.getObject(storeAtKey, defaultValue) as T;
    this.setState({ value });
  }

  onSaveToStore(value: T) {
    const { storeAtKey } = this.props;
    store.setObject(storeAtKey, value);
    this.setState({ value });
  }

  render() {
    const { children } = this.props;
    const { value } = this.state;

    return <>{children(value, this.onSaveToStore.bind(this))}</>;
  }
}
