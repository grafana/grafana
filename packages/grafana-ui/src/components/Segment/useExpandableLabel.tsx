import { useState, useRef, ReactElement } from 'react';
import * as React from 'react';

import { useStyles2 } from '../../themes/ThemeContext';
import { clearButtonStyles } from '../Button/Button';

interface LabelProps {
  Component: ReactElement;
  onClick?: () => void;
  disabled?: boolean;
}

export const useExpandableLabel = (
  initialExpanded: boolean,
  onExpandedChange?: (expanded: boolean) => void
): [React.ComponentType<LabelProps>, number, boolean, (expanded: boolean) => void] => {
  const ref = useRef<HTMLButtonElement>(null);
  const buttonStyles = useStyles2(clearButtonStyles);
  const [expanded, setExpanded] = useState<boolean>(initialExpanded);
  const [width, setWidth] = useState(0);

  const setExpandedWrapper = (expanded: boolean) => {
    setExpanded(expanded);
    if (onExpandedChange) {
      onExpandedChange(expanded);
    }
  };

  const Label = ({ Component, onClick, disabled }: LabelProps) => (
    <button
      type="button"
      className={buttonStyles}
      ref={ref}
      disabled={disabled}
      onClick={() => {
        setExpandedWrapper(true);
        if (ref && ref.current) {
          setWidth(ref.current.clientWidth * 1.25);
        }
        onClick?.();
      }}
    >
      {Component}
    </button>
  );

  return [Label, width, expanded, setExpandedWrapper];
};
