import React, { useState, useRef, ReactElement } from 'react';

export const useExpandableLabel = (initialExpanded: boolean) => {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(initialExpanded);
  const [width, setWidth] = useState();
  const Label = ({ Component, onClick }: { Component: ReactElement; onClick: () => void }) => (
    <div
      className="gf-form"
      ref={ref}
      onClick={() => {
        setExpanded(true);
        if (ref && ref.current) {
          setWidth(ref.current.clientWidth * 1.25);
        }
        if (onClick) {
          onClick();
        }
      }}
    >
      {Component}
    </div>
  );

  return [Label, width, expanded, setExpanded];
};
