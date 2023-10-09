import React, { forwardRef, Ref } from 'react';

interface ConditionalWrapProps {
  shouldWrap: boolean;
  children: JSX.Element;
  wrap: (children: JSX.Element) => JSX.Element;
}

function ConditionalWrap({ children, shouldWrap, wrap }: ConditionalWrapProps, _ref: Ref<HTMLElement>) {
  return shouldWrap ? React.cloneElement(wrap(children)) : children;
}

export default forwardRef(ConditionalWrap);
