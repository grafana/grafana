import { GrafanaTheme } from '@grafana/data';
import { Icon, stylesFactory, useTheme } from '@grafana/ui';
import { css, cx } from 'emotion';
import React, { FunctionComponent, useState } from 'react';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      display: flex;
      flex-direction: column;
    `,
    settingsWrapper: css`
      padding-top: ${theme.spacing.xs};
    `,
    icon: css`
      margin-right: ${theme.spacing.xs};
    `,
    button: css`
      justify-content: start;
    `,
  };
});
interface Props {
  label: string;
}

export const SettingsEditorContainer: FunctionComponent<Props> = ({ label, children }) => {
  const [open, setOpen] = useState(false);

  const styles = getStyles(useTheme());

  return (
    <div className={styles.wrapper}>
      <button className={cx('gf-form-label', styles.button)} onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon name={open ? 'angle-down' : 'angle-right'} aria-hidden="true" className={styles.icon} />
        {label}
      </button>

      {open && <div className={styles.settingsWrapper}>{children}</div>}
    </div>
  );
};
