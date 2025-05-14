import { cx } from '@emotion/css';

import { useStyles2 } from '../../themes';

import { getComboboxStyles } from './getComboboxStyles';

interface Props {
  label: string;
  description?: string;
  id: string;
  isGroup?: boolean;
}

export const OptionListItem = ({ label, description, id, isGroup = false }: Props) => {
  const styles = useStyles2(getComboboxStyles);
  return (
    <div className={styles.optionBody} aria-disabled={isGroup}>
      <span className={cx(styles.optionLabel, { [styles.optionLabelGroup]: isGroup })} id={id}>
        {label}
      </span>
      {description && <span className={styles.optionDescription}>{description}</span>}
    </div>
  );
};
