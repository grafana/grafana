import React, { PureComponent } from 'react';

import { ListProps, AbstractList } from './AbstractList';

export class List<T> extends PureComponent<ListProps<T>> {
  render() {
    return <AbstractList {...this.props} />;
  }
}
