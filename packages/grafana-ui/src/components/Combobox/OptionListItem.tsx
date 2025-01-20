import { useStyles2 } from '../../themes';

import { getComboboxStyles } from './getComboboxStyles';

interface Props {
  label: string;
  description?: string;
  id: string;
}

export const OptionListItem = ({ label, description, id }: Props) => {
  const styles = useStyles2(getComboboxStyles);
  return (
    <div className={styles.optionBody}>
      <span className={styles.optionLabel} id={id}>
        {label}
      </span>
      {description && <span className={styles.optionDescription}>{description}</span>}
    </div>
  );
};
