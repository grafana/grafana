import React, { FC } from 'react';
import { css } from 'emotion';

export interface ToggleButtonGroupProps {
  label?: string;
  children: JSX.Element[];
  // Set all childrens' propsPriority
  propsPriority?: boolean;
}

const styles = {
  label: css`
    margin: 0 10px 0 10px;
  `,
  buttons: css`
    display: inline-block;

    &:first-child {
      border-radius: 2px 0 0 2px;
      margin-left: 0;
    }
    &:last-child {
      border-radius: 0 2px 2px 0;
    }
  `,
};

const ToggleButtonGroup: FC<ToggleButtonGroupProps> = ({ label, children, propsPriority }) => {
  return (
    <div>
      <span className={styles.label}>{label}</span>
      <div className={styles.buttons}>
        {React.Children.map(children, (child: any) => {
          return React.cloneElement(child, {
            propsPriority,
          });
        })}
      </div>
    </div>
  );
};

ToggleButtonGroup.displayName = 'ToggleButtonGroup';

export { ToggleButtonGroup };
