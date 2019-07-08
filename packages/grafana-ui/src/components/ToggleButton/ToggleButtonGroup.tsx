import React, { FC } from 'react';
import { css } from 'emotion';

export interface ToggleButtonGroupProps {
  label?: string;
  children: JSX.Element[];
  // Set all childrens' controlled
  controlled?: boolean;
}

const styles = {
  label: css`
    margin: 0 10px 0 10px;
  `,
  buttons: css`
    display: inline-block;
    & > button {
      border-radius: 0;

      &:last-child {
        border-radius: 0 2px 2px 0;
      }

      &:first-child {
        border-radius: 2px 0 0 2px;
        margin-left: 0;
      }
    }
  `,
};

const ToggleButtonGroup: FC<ToggleButtonGroupProps> = ({ label, children, controlled }) => {
  return (
    <div>
      {label ? <span className={styles.label}>{label}</span> : null}

      <div className={styles.buttons}>
        {React.Children.map(children, (child: any) => {
          return React.cloneElement(child, {
            controlled,
          });
        })}
      </div>
    </div>
  );
};

ToggleButtonGroup.displayName = 'ToggleButtonGroup';

export { ToggleButtonGroup };
