import React from 'react';

interface ConditionalWrapProps {
  shouldWrap: boolean;
  children: JSX.Element;
  wrap: (children: JSX.Element) => JSX.Element;
}

export const ConditionalWrap = ({ shouldWrap, children, wrap }: ConditionalWrapProps): JSX.Element =>
  shouldWrap ? React.cloneElement(wrap(children)) : children;

export default ConditionalWrap;
