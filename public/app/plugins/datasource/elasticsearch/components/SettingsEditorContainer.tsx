import { Icon } from '@grafana/ui';
import { css, cx } from 'emotion';
import React, { FunctionComponent, useState } from 'react';

interface Props {
  label: string;
}
export const SettingsEditorContainer: FunctionComponent<Props> = ({ label, children }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className={cx(
          'gf-form-label',
          css`
            justify-content: start;
          `,
          open &&
            css`
              margin: 0 4px 4px 0;
            `
        )}
        onClick={() => setOpen(!open)}
      >
        <Icon name={open ? 'angle-down' : 'angle-right'} />
        {label}
      </button>

      {open && children}
    </>
  );
};
