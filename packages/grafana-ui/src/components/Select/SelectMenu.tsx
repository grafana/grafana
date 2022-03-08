import React, { FC, RefCallback, useCallback } from 'react';
import { cx } from '@emotion/css';
import { SelectableValue } from '@grafana/data';
import { useIntersection } from 'react-use';

import { useTheme2 } from '../../themes/ThemeContext';
import { getSelectStyles } from './getSelectStyles';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';
import { Icon } from '../Icon/Icon';
import { IconName } from '../../types';
import { Tooltip } from '../Tooltip/Tooltip';

interface SelectMenuProps {
  maxHeight: number;
  innerRef: RefCallback<HTMLDivElement>;
  innerProps: {};
}

export const SelectMenu: FC<SelectMenuProps> = ({ children, maxHeight, innerRef, innerProps }) => {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);

  return (
    <div
      id="select-menu-list-test"
      {...innerProps}
      className={styles.menu}
      style={{ maxHeight }}
      aria-label="Select options menu"
    >
      <CustomScrollbar scrollRefCallback={innerRef} autoHide={false} autoHeightMax="inherit" hideHorizontalTrack>
        {children}
      </CustomScrollbar>
    </div>
  );
};

SelectMenu.displayName = 'SelectMenu';

interface SelectMenuOptionProps<T> {
  isDisabled: boolean;
  isFocused: boolean;
  isSelected: boolean;
  innerProps: any;
  innerRef: RefCallback<HTMLDivElement>;
  renderOptionLabel?: (value: SelectableValue<T>) => JSX.Element;
  data: SelectableValue<T>;
}

export const SelectMenuOptions: FC<SelectMenuOptionProps<any>> = ({
  children,
  data,
  innerProps,
  innerRef,
  isFocused,
  isSelected,
  renderOptionLabel,
}) => {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);
  const contentRef = React.useRef(null);

  const intersection = useIntersection(contentRef, {
    root: document.querySelector('#select-menu-list-test'),
    rootMargin: '0px',
    threshold: 0.5,
  });

  // We need ref internally but also need to supply it to the parent. This also needs to be in useCallback as having
  // inline function as ref messes things up.
  const refFunc = useCallback(
    (el) => {
      innerRef?.(el);
      contentRef.current = el;
    },
    [innerRef, contentRef]
  );

  let content = (
    <div
      className={cx(
        styles.option,
        isFocused && styles.optionFocused,
        isSelected && styles.optionSelected,
        data.isDisabled && styles.optionDisabled
      )}
      {...innerProps}
      aria-label="Select option"
    >
      {data.icon && <Icon name={data.icon as IconName} className={styles.optionIcon} />}
      {data.imgUrl && <img className={styles.optionImage} src={data.imgUrl} alt={data.label || data.value} />}
      <div className={styles.optionBody}>
        <span>{renderOptionLabel ? renderOptionLabel(data) : children}</span>
        {data.description && <div className={styles.optionDescription}>{data.description}</div>}
        {data.component && <data.component />}
      </div>
    </div>
  );

  if (data.tooltip) {
    content = (
      <Tooltip
        content={data.tooltip}
        show={isFocused && (intersection?.intersectionRatio || 0) > 0.5}
        interactive={false}
        placement={'right'}
      >
        {content}
      </Tooltip>
    );
  }
  return <div ref={refFunc}>{content}</div>;
};

SelectMenuOptions.displayName = 'SelectMenuOptions';
