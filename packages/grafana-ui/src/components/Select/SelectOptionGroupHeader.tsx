import { GroupHeadingProps } from 'react-select';

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
