import React, { useState, useRef, ReactElement } from 'react';

export const useExpandableLabel = (initialExpanded: boolean) => {
  const ref = useRef(null);
  const [expanded, setExpanded] = useState(initialExpanded);
  const [width, setWidth] = useState();
  const Label = ({ Component, onClick }: { Component: ReactElement; onClick: () => void }) => (
    <div
      className="gf-form"
      ref={ref}
      onClick={() => {
        ref && ref.current && setWidth(ref.current.clientWidth);
        setExpanded(true);
        onClick && onClick();
      }}
    >
      {Component}
    </div>
  );

  return [Label, width, expanded, setExpanded];
};
