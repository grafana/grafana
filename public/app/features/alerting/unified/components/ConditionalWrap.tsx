import { cloneElement, forwardRef } from 'react';

interface ConditionalWrapProps {
  shouldWrap: boolean;
  children: JSX.Element;
  wrap: (children: JSX.Element) => JSX.Element;
}

function ConditionalWrap({ children, shouldWrap, wrap }: ConditionalWrapProps) {
  return shouldWrap ? cloneElement(wrap(children)) : children;
}

export default forwardRef(ConditionalWrap);
