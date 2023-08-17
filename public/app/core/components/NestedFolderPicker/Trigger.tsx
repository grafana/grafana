import { css, cx } from '@emotion/css';
import React, { forwardRef, ReactNode, ButtonHTMLAttributes } from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, getInputStyles, useTheme2, Text } from '@grafana/ui';
import { focusCss } from '@grafana/ui/src/themes/mixins';
import { Trans } from 'app/core/internationalization';

interface TriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading: boolean;
  invalid?: boolean;
  label?: ReactNode;
}

function Trigger({ isLoading, invalid, label, ...rest }: TriggerProps, ref: React.ForwardedRef<HTMLButtonElement>) {
  const theme = useTheme2();
  const styles = getStyles(theme, invalid);

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputWrapper}>
        {label ? (
          <div className={styles.prefix}>
            <Icon name="folder" />
          </div>
        ) : undefined}

        <button
          type="button"
          className={cx(styles.fakeInput, label ? styles.hasPrefix : undefined)}
          {...rest}
          ref={ref}
        >
          {isLoading ? (
            <Skeleton width={100} />
          ) : label ? (
            <Text truncate>{label}</Text>
          ) : (
            <Text truncate color="secondary">
              <Trans i18nKey="browse-dashboards.folder-picker.button-label">Select folder</Trans>
            </Text>
          )}
        </button>

        <div className={styles.suffix}>
          <Icon name="angle-down" />
        </div>
      </div>
    </div>
  );
}

export default forwardRef(Trigger);

const getStyles = (theme: GrafanaTheme2, invalid = false) => {
  const baseStyles = getInputStyles({ theme, invalid });

  return {
    wrapper: baseStyles.wrapper,
    inputWrapper: baseStyles.inputWrapper,

    prefix: css([
      baseStyles.prefix,
      {
        pointerEvents: 'none',
        color: theme.colors.text.primary,
      },
    ]),

    suffix: css([
      baseStyles.suffix,
      {
        pointerEvents: 'none',
      },
    ]),

    fakeInput: css([
      baseStyles.input,
      {
        textAlign: 'left',

        letterSpacing: 'normal',

        // We want the focus styles to appear only when tabbing through, not when clicking the button
        // (and when focus is restored after command palette closes)
        '&:focus': {
          outline: 'unset',
          boxShadow: 'unset',
        },

        '&:focus-visible': css`
          ${focusCss(theme)}
        `,
      },
    ]),

    hasPrefix: css({
      paddingLeft: 28,
    }),
  };
};
