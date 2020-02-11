import React from 'react';
import { ListProps, AbstractList } from './AbstractList';

export class InlineList<T> extends React.PureComponent<ListProps<T>> {
  render() {
    return <AbstractList inline {...this.props} />;
  }
}
