import { GroupProps } from 'react-select';

import { useStyles2 } from '../../themes/ThemeContext';

import { getSelectStyles } from './getSelectStyles';

export const SelectOptionGroup = ({
  children,
  cx,
  getClassNames,
  getStyles,
  Heading,
  headingProps,
  label,
  selectProps,
  theme,
}: GroupProps) => {
  const styles = useStyles2(getSelectStyles);
  return (
    <div className={styles.group}>
      <Heading
        cx={cx}
        getClassNames={getClassNames}
        getStyles={getStyles}
        selectProps={selectProps}
        theme={theme}
        {...headingProps}
      >
        {label}
      </Heading>
      {children}
    </div>
  );
};
