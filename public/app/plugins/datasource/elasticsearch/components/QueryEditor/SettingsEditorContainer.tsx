import { css, cx } from '@emotion/css';
import { PropsWithChildren, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, InlineSegmentGroup, useTheme2 } from '@grafana/ui';

import { segmentStyles } from './styles';

const getStyles = (theme: GrafanaTheme2, hidden: boolean) => {
  return {
    wrapper: css({
      maxWidth: '500px',
      display: 'flex',
      flexDirection: 'column',
    }),
    settingsWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      paddingTop: theme.spacing(0.5),
    }),
    icon: css({
      marginRight: theme.spacing(0.5),
    }),
    button: css(
      {
        justifyContent: 'flex-start',
        display: 'flex',
        alignItems: 'center',
        padding: theme.spacing(0, 1),
        fontSize: theme.typography.bodySmall.fontSize,
        backgroundColor: theme.colors.background.secondary,
        height: '32px',
        lineHeight: '32px',
        border: 'none',
      },
      hidden && {
        color: theme.colors.text.disabled,
      }
    ),
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
          className={cx(styles.button, segmentStyles)}
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
