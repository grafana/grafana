import { PureComponent } from 'react';

import { ListProps, AbstractList } from './AbstractList';

/** @deprecated Use ul/li/arr.map directly instead */
export class InlineList<T> extends PureComponent<ListProps<T>> {
  render() {
    return <AbstractList inline {...this.props} />;
  }
}
