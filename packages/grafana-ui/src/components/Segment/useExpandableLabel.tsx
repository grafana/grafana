import React, { useState, useRef, ReactElement } from 'react';
import { cx } from 'emotion';

type Hook = (
  initialExpanded: boolean,
  value: any | any[],
  className?: string,
  CustomComponent?: ReactElement
) => [
  ({ onClick }: { onClick?: () => void }) => JSX.Element,
  number,
  boolean,
  React.Dispatch<React.SetStateAction<boolean>>
];

export const useExpandableLabel: Hook = (initialExpanded, value, className, CustomComponent) => {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<boolean>(initialExpanded);
  const [width, setWidth] = useState<number>(0);

  const Label = ({ onClick }: { onClick?: () => void }) => (
    <div
      className="gf-form"
      ref={ref}
      onClick={() => {
        setExpanded(true);
        if (ref && ref.current) {
          setWidth(ref.current.clientWidth);
        }
        if (onClick) {
          onClick();
        }
      }}
    >
      {CustomComponent || (
        <a className={cx('gf-form-label', 'query-part', className)}>
          {Array.isArray(value) && value.length > 1 ? `(${value.length}) selected` : value}
        </a>
      )}
    </div>
  );

  return [Label, width, expanded, setExpanded];
};
