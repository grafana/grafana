import { css, cx } from '@emotion/css';
import React, { ReactNode, useState } from 'react';

import { IconButton } from '@grafana/ui';

interface Props {
  label: ReactNode;
  onRemove: () => void;
  children: ReactNode;
  isOpen?: boolean;
}

export function Collapsable({ label, children, isOpen = false, onRemove }: Props) {
  const [open, setOpen] = useState<boolean>(isOpen);
  const style = getStyle();

  return (
    <div className={cx(style.container)}>
      <div onClick={() => setOpen(!open)} className={cx(style.containerLabel)}>
        <div className={style.leftContainerLabel}>
          <IconButton
            className={cx(style.iconOrLabel)}
            name={open ? 'angle-up' : 'angle-down'}
            onClick={() => setOpen(!open)}
          />
          <div className={cx(style.iconOrLabel)}>{label}</div>
        </div>
        <div>
          <IconButton className={cx(style.iconOrLabel)} name={'trash-alt'} onClick={() => onRemove()} />
        </div>
      </div>
      {open && <div className={cx(style.childrenContainer)}>{children}</div>}
    </div>
  );
}

function getStyle() {
  return {
    container: css`
      margin-bottom: 20px;
    `,
    containerLabel: css`
      background-color: #22252b;
      padding: 4px;
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      align-items: center;
    `,
    leftContainerLabel: css`
      display: flex;
      flex-direction: row;
      align-items: center;
    `,
    iconOrLabel: css`
      margin: 4px;
    `,
    childrenContainer: css`
      margin-left: 20px;
    `,
  };
}
