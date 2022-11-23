import { cx } from '@emotion/css';
import { RadioButton } from '@percona/platform-core/dist/components/RadioButtonGroup/RadioButton';
import React, { FC } from 'react';
import { Field } from 'react-final-form';

import { useStyles2 } from '@grafana/ui';

import { getStyles } from './PageSwitcher.styles';
import { PageSwitcherProps } from './PageSwitcher.types';

export const PageSwitcher: FC<PageSwitcherProps> = ({ values, className }) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.pageSwitcherWrapper, className)}>
      {values.map((item) => (
        <Field
          name={`${item.name}`}
          component="input"
          type="radio"
          key={`radio-field-${item.value}`}
          value={item.value}
        >
          {({ input }) => (
            <RadioButton
              {...input}
              onChange={() => {
                item.onChange && item.onChange();
                input.onChange({ target: { value: input.value } });
              }}
            >
              {item.label}
            </RadioButton>
          )}
        </Field>
      ))}
    </div>
  );
};
