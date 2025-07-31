import { css, cx } from '@emotion/css';
import RCCascader, { FieldNames } from 'rc-cascader';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { IconName } from '../../types/icon';
import { Button, ButtonProps } from '../Button/Button';
import { CascaderOption } from '../Cascader/Cascader';
import { onChangeCascader, onLoadDataCascader } from '../Cascader/optionMappings';
import { getCascaderStyles } from '../Cascader/styles';
import { Icon } from '../Icon/Icon';

export interface ButtonCascaderProps {
  options: CascaderOption[];
  children?: string;
  icon?: IconName;
  disabled?: boolean;
  value?: string[];
  fieldNames?: FieldNames<CascaderOption, keyof CascaderOption>;
  loadData?: (selectedOptions: CascaderOption[]) => void;
  onChange?: (value: string[], selectedOptions: CascaderOption[]) => void;
  onPopupVisibleChange?: (visible: boolean) => void;
  className?: string;
  variant?: ButtonProps['variant'];
  buttonProps?: ButtonProps;
  hideDownIcon?: boolean;
}

export const ButtonCascader = (props: ButtonCascaderProps) => {
  const { onChange, className, loadData, icon, buttonProps, hideDownIcon, variant, disabled, ...rest } = props;
  const styles = useStyles2(getStyles);
  const cascaderStyles = useStyles2(getCascaderStyles);

  // Weird way to do this bit it goes around a styling issue in Button where even null/undefined child triggers
  // styling change which messes up the look if there is only single icon content.
  let content: React.ReactNode = props.children;
  if (!hideDownIcon) {
    content = [props.children, <Icon key={'down-icon'} name="angle-down" className={styles.icons.right} />];
  }

  return (
    <RCCascader
      onChange={onChangeCascader(onChange)}
      loadData={onLoadDataCascader(loadData)}
      dropdownClassName={cx(cascaderStyles.dropdown, styles.popup)}
      {...rest}
      expandIcon={null}
    >
      <Button icon={icon} disabled={disabled} variant={variant} {...(buttonProps ?? {})}>
        {content}
      </Button>
    </RCCascader>
  );
};

ButtonCascader.displayName = 'ButtonCascader';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    popup: css({
      label: 'popup',
      zIndex: theme.zIndex.dropdown,
    }),
    icons: {
      right: css({
        margin: '1px 0 0 4px',
      }),
      left: css({
        margin: '-1px 4px 0 0',
      }),
    },
  };
};
