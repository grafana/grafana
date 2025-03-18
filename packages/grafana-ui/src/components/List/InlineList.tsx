import { PureComponent } from 'react';

import { ListProps, AbstractList } from './AbstractList';

export class InlineList<T> extends PureComponent<ListProps<T>> {
  render() {
    return <AbstractList inline {...this.props} />;
  }
}
