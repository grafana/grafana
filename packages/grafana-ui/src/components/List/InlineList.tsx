import { type ListProps, AbstractList } from './AbstractList';

/** @deprecated Use ul/li/arr.map directly instead */
// no point converting, this is deprecated
// eslint-disable-next-line react-prefer-function-component/react-prefer-function-component
export const InlineList = <T,>(props: ListProps<T>) => {
  return <AbstractList inline {...props} />;
};
