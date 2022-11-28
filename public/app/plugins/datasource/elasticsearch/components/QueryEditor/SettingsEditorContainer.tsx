import { css, cx } from '@emotion/css';
import React, { PropsWithChildren, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, InlineSegmentGroup, useTheme2 } from '@grafana/ui';

import { segmentStyles } from './styles';

const getStyles = (theme: GrafanaTheme2, hidden: boolean) => {
  return {
    wrapper: css`
      max-width: 500px;
      display: flex;
      flex-direction: column;
    `,
    settingsWrapper: css`
      padding-top: ${theme.spacing(0.5)};
    `,
    icon: css`
      margin-right: ${theme.spacing(0.5)};
    `,
    button: css`
      justify-content: start;
      ${hidden &&
      css`
        color: ${theme.colors.text.disabled};
      `}
    `,
  };
};

interface Props {
  label: string;
  hidden?: boolean;
}

export const SettingsEditorContainer = ({ label, children, hidden = false }: PropsWithChildren<Props>) => {
  const [open, setOpen] = useState(false);

  const theme = useTheme2();
  const styles = getStyles(theme, hidden);

  return (
    <InlineSegmentGroup>
      <div className={cx(styles.wrapper)}>
        <button
          className={cx('gf-form-label query-part', styles.button, segmentStyles)}
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          type="button"
        >
          <Icon name={open ? 'angle-down' : 'angle-right'} aria-hidden="true" className={styles.icon} />
          {label}
        </button>

        {open && <div className={styles.settingsWrapper}>{children}</div>}
      </div>
    </InlineSegmentGroup>
  );
};
