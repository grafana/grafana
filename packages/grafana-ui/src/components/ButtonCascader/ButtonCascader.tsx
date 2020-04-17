import React from 'react';
import { Icon } from '../Icon/Icon';
import { css, cx } from 'emotion';

// @ts-ignore
import RCCascader from 'rc-cascader';
import { CascaderOption } from '../Cascader/Cascader';
import { onChangeCascader, onLoadDataCascader } from '../Cascader/optionMappings';
import { stylesFactory } from '../../themes';

export interface ButtonCascaderProps {
  options: CascaderOption[];
  children: string;
  disabled?: boolean;
  value?: string[];
  fieldNames?: { label: string; value: string; children: string };
  loadData?: (selectedOptions: CascaderOption[]) => void;
  onChange?: (value: string[], selectedOptions: CascaderOption[]) => void;
  onPopupVisibleChange?: (visible: boolean) => void;
  className?: string;
}

const getStyles = stylesFactory(() => {
  return {
    popup: css`
      label: popup;
      z-index: 100;
    `,
    icon: css`
      margin: 1px 0 0 4px;
    `,
  };
});

export const ButtonCascader: React.FC<ButtonCascaderProps> = props => {
  const { onChange, className, loadData, ...rest } = props;
  const styles = getStyles();

  return (
    <RCCascader
      onChange={onChangeCascader(onChange)}
      loadData={onLoadDataCascader(loadData)}
      popupClassName={styles.popup}
      {...rest}
      expandIcon={null}
    >
      <button className={cx('gf-form-label', className)} disabled={props.disabled}>
        {props.children} <Icon name="angle-down" className={styles.icon} />
      </button>
    </RCCascader>
  );
};
