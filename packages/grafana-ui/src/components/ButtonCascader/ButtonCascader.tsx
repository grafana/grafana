import { css } from '@emotion/css';
import RCCascader from 'rc-cascader';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { stylesFactory, useTheme2 } from '../../themes';
import { IconName } from '../../types/icon';
import { Button, ButtonProps } from '../Button';
import { CascaderOption } from '../Cascader/Cascader';
import { onChangeCascader, onLoadDataCascader } from '../Cascader/optionMappings';
import { Icon } from '../Icon/Icon';

export interface ButtonCascaderProps {
  options: CascaderOption[];
  children?: string;
  icon?: IconName;
  disabled?: boolean;
  value?: string[];
  fieldNames?: { label: string; value: string; children: string };
  loadData?: (selectedOptions: CascaderOption[]) => void;
  onChange?: (value: string[], selectedOptions: CascaderOption[]) => void;
  onPopupVisibleChange?: (visible: boolean) => void;
  className?: string;
  variant?: ButtonProps['variant'];
  buttonProps?: ButtonProps;
  hideDownIcon?: boolean;
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    popup: css`
      label: popup;
      z-index: ${theme.zIndex.dropdown};
    `,
    icons: {
      right: css`
        margin: 1px 0 0 4px;
      `,
      left: css`
        margin: -1px 4px 0 0;
      `,
    },
  };
});

export const ButtonCascader = (props: ButtonCascaderProps) => {
  const { onChange, className, loadData, icon, buttonProps, hideDownIcon, variant, disabled, ...rest } = props;
  const theme = useTheme2();
  const styles = getStyles(theme);

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
      dropdownClassName={styles.popup}
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
