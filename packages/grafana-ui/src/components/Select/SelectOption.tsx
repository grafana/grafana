import React from 'react';
import { css, cx } from 'emotion';

// Ignoring because I couldn't get @types/react-select work wih Torkel's fork
// @ts-ignore
import { components } from '@torkelo/react-select';
import { OptionProps } from 'react-select/lib/components/Option';
import { FadeTransition, Spinner } from '..';
import { useDelayedSwitch } from '../../utils/useDelayedSwitch';

// https://github.com/JedWatson/react-select/issues/3038
export interface ExtendedOptionProps extends OptionProps<any> {
  data: {
    description?: string;
    imgUrl?: string;
  };
}

export const SelectOption = (props: ExtendedOptionProps) => {
  const { children, isSelected, data } = props;

  return (
    <components.Option {...props}>
      <div className="gf-form-select-box__desc-option">
        {data.imgUrl && <img className="gf-form-select-box__desc-option__img" src={data.imgUrl} />}
        <div className="gf-form-select-box__desc-option__body">
          <div>{children}</div>
          {data.description && <div className="gf-form-select-box__desc-option__desc">{data.description}</div>}
        </div>
        {isSelected && <i className="fa fa-check" aria-hidden="true" />}
      </div>
    </components.Option>
  );
};

// was not able to type this without typescript error
export const SingleValue = (props: any) => {
  const { children, data } = props;

  const containerStyle = css`
    width: 16px;
    height: 16px;
    display: inline-block;
    margin-right: 10px;
    position: relative;
    vertical-align: middle;
  `;

  const itemStyle = css`
    width: 100%;
    height: 100%;
    position: absolute;
  `;

  const loading = useDelayedSwitch(data.loading, { after: 0, min: 3000 });

  return (
    <components.SingleValue {...props}>
      <div className={cx('gf-form-select-box__img-value')}>
        <div className={containerStyle}>
          <FadeTransition visible={loading}>
            <Spinner className={itemStyle} inline />
          </FadeTransition>
          {data.imgUrl && (
            <FadeTransition visible={!loading}>
              <img className={itemStyle} src={data.imgUrl} />
            </FadeTransition>
          )}
        </div>
        {children}
      </div>
    </components.SingleValue>
  );
};

export default SelectOption;
