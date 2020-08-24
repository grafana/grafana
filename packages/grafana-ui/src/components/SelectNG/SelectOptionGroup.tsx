import React from 'react';
import { css } from 'emotion';
import { GetItemPropsOptions } from 'downshift';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { selectThemeVariant, useStyles } from '../../themes';

interface SelectOptionGroupProps {
  option: {
    label: string;
    expanded: boolean;
    options: SelectableValue[];
  };
  index: number;
  renderOption: (option: SelectableValue, index: number) => React.ReactNode;
  getItemProps: (options: GetItemPropsOptions<SelectableValue>) => any;
}

const getSelectOptionGroupStyles = (theme: GrafanaTheme) => {
  const optionBorder = selectThemeVariant(
    {
      light: theme.palette.gray4,
      dark: theme.palette.dark9,
    },
    theme.type
  );
  return {
    header: css`
      display: flex;
      align-items: center;
      justify-content: flex-start;
      justify-items: center;
      cursor: default;
      padding: 7px 10px;
      width: 100%;
      border-bottom: 1px solid ${optionBorder};
      text-transform: capitalize;
    `,
    label: css`
      flex-grow: 1;
    `,
    icon: css`
      padding-right: 2px;
    `,
  };
};

export const SelectOptionGroup: React.FC<SelectOptionGroupProps> = ({ option, renderOption, index }) => {
  const styles = useStyles(getSelectOptionGroupStyles);

  return (
    <div>
      <div className={styles.header}>
        <span className={styles.label}>{option.label}</span>
        {/*<Icon className={styles.icon} name={expanded ? 'angle-left' : 'angle-down'} />{' '}*/}
      </div>
      {option.options.map((o, i) => renderOption(o, index + i))}
    </div>
  );
};
