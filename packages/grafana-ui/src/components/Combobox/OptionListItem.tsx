import { useStyles2 } from '../../themes';

import { ComboboxOption } from './Combobox';
import { getComboboxStyles } from './getComboboxStyles';

interface Props {
  option: ComboboxOption<string | number>;
  id: string;
}

export const OptionListItem = ({ option, id }: Props) => {
  const styles = useStyles2(getComboboxStyles);
  return (
    <div className={styles.optionBody}>
      <span className={styles.optionLabel} id={id}>
        {option.label ?? option.value}
      </span>
      {option.description && <span className={styles.optionDescription}>{option.description}</span>}
    </div>
  );
};
