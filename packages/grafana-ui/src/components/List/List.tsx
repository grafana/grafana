import { PureComponent } from 'react';

import { ListProps, AbstractList } from './AbstractList';

/** @deprecated Use ul/li/arr.map directly instead */
// no point converting, this is deprecated
// eslint-disable-next-line react-prefer-function-component/react-prefer-function-component
export class List<T> extends PureComponent<ListProps<T>> {
  render() {
    return <AbstractList {...this.props} />;
  }
}
