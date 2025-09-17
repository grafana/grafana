import { PureComponent } from 'react';

import { ListProps, AbstractList } from './AbstractList';

/** @deprecated Use ul/li/arr.map directly instead */
export class List<T> extends PureComponent<ListProps<T>> {
  render() {
    return <AbstractList {...this.props} />;
  }
}
