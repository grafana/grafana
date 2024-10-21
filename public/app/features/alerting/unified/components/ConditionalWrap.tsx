import { cloneElement, forwardRef, Ref } from 'react';

interface ConditionalWrapProps {
  shouldWrap: boolean;
  children: JSX.Element;
  wrap: (children: JSX.Element) => JSX.Element;
}

function ConditionalWrap({ children, shouldWrap, wrap }: ConditionalWrapProps, ref: Ref<HTMLElement>) {
  return shouldWrap ? cloneElement(wrap(children), { ref }) : children;
}

export default forwardRef(ConditionalWrap);
