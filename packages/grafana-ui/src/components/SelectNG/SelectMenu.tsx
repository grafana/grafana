import React from 'react';
import { cx } from 'emotion';
import { SelectableValue } from '@grafana/data';
import { useStyles, useTheme } from '../../themes';
import { getSelectStyles } from '../Select/getSelectStyles';
import { CustomScrollbar, Icon } from '..';
import { GetItemPropsOptions } from 'downshift';

interface SelectMenuProps {
  maxHeight?: number;
  options: SelectableValue[];
  getItemProps: (options: GetItemPropsOptions<SelectableValue>) => any;
  highlightedIndex: number;
  selectedItem: SelectableValue;
}

// This is pretty much the same implementation as current's Select menu, apart from react-select specific props (innerRef, innerProps)
export const SelectMenu = React.forwardRef<HTMLDivElement, SelectMenuProps>((props, ref) => {
  const theme = useTheme();
  const styles = getSelectStyles(theme);

  const { maxHeight = 300, options, highlightedIndex, selectedItem, ...otherProps } = props;

  return (
    <div className={styles.menu} style={{ maxHeight }} {...otherProps} ref={ref}>
      <CustomScrollbar autoHide={false} autoHeightMax="inherit" hideHorizontalTrack>
        {options.map((o, index) => {
          const itemProps = props.getItemProps({
            key: o.value,
            index,
            item: o,
          });
          return (
            <SelectMenuOption
              data={o}
              {...itemProps}
              isFocused={highlightedIndex === index}
              isSelected={selectedItem === o}
            />
          );
        })}
      </CustomScrollbar>
    </div>
  );
});

SelectMenu.displayName = 'SelectMenu';

interface SelectMenuOptionProps<T> {
  isDisabled?: boolean;
  isFocused?: boolean;
  isSelected?: boolean;
  renderOptionLabel?: (value: SelectableValue<T>) => JSX.Element;
  data: SelectableValue<T>;
}

export const SelectMenuOption: React.FC<SelectMenuOptionProps<any>> = props => {
  const theme = useTheme();
  const styles = getSelectStyles(theme);
  const { children, data, renderOptionLabel, isSelected, isFocused, ...otherProps } = props;

  return (
    <div {...otherProps} className={cx(styles.option, isFocused && styles.optionFocused)}>
      {data.imgUrl && <img className={styles.optionImage} src={data.imgUrl} />}
      <div className={styles.optionBody}>
        <span>{renderOptionLabel ? renderOptionLabel(data) : data.label}</span>
        {data.description && <div className={styles.optionDescription}>{data.description}</div>}
      </div>
      {isSelected && (
        <span>
          <Icon name="check" />
        </span>
      )}
    </div>
  );
};

SelectMenuOption.displayName = 'SelectMenuOption';

interface SelectMenuMessageProps {
  text: string;
}
export const SelectMenuMessage: React.FC<SelectMenuMessageProps> = ({ text }) => {
  const styles = useStyles(getSelectStyles);
  return (
    <div className={styles.menu}>
      <div className={styles.loadingMessage}>{text}</div>
    </div>
  );
};
