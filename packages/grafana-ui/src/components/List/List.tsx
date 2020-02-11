import React from 'react';
import { ListProps, AbstractList } from './AbstractList';

export class List<T> extends React.PureComponent<ListProps<T>> {
  render() {
    return <AbstractList {...this.props} />;
  }
}
