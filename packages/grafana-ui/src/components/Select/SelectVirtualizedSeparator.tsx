import { useStyles2 } from '../../themes/ThemeContext';

import { getSelectStyles } from './getSelectStyles';

export const SelectVirtualizedSeparator = () => {
  const styles = useStyles2(getSelectStyles);

  return <div className={styles.virtualizedSeparator} />;
};
