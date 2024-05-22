import React from 'react';
import { GroupHeadingProps, GroupProps } from 'react-select';

import { useStyles2 } from '../../themes/ThemeContext';
import { Text } from '../Text/Text';

import { getSelectStyles } from './getSelectStyles';

export const SelectOptionGroupHeader = (props: GroupHeadingProps) => {
  const styles = useStyles2(getSelectStyles);

  return (
    <div className={styles.groupHeader}>
      <Text weight="bold" variant="bodySmall" color="secondary">
        {props.children ?? ''}
      </Text>
    </div>
  );
};

export const SelectOptionGroup = ({
  children,
  Heading,
  headingProps,
  label,
  selectProps,
  theme,
  getStyles,
  getClassNames,
  cx,
}: GroupProps) => {
  return (
    <>
      <Heading
        {...headingProps}
        selectProps={selectProps}
        theme={theme}
        getStyles={getStyles}
        getClassNames={getClassNames}
        cx={cx}
      >
        {label}
      </Heading>
      {children}
    </>
  );
};
