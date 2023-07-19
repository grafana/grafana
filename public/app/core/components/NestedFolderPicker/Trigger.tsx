import { css } from '@emotion/css';
import React, { forwardRef, ReactNode, ButtonHTMLAttributes } from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Icon, getInputStyles } from '@grafana/ui';
import { Text } from '@grafana/ui/src/components/Text/Text';
import { focusCss } from '@grafana/ui/src/themes/mixins';
import { Trans } from 'app/core/internationalization';

interface TriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading: boolean;
  label?: ReactNode;
}

function Trigger({ isLoading, label, ...rest }: TriggerProps, ref: React.ForwardedRef<HTMLButtonElement>) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputWrapper}>
        {label ? (
          <div className={styles.prefix}>
            <Icon name="folder" />
          </div>
        ) : undefined}

        <button className={styles.fakeInput} {...rest} ref={ref}>
          {isLoading ? (
            <Skeleton width={100} />
          ) : (
            <Text as="span" truncate>
              {label ?? <Trans i18nKey="browse-dashboards.folder-picker.button-label">Select folder</Trans>}
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

const getStyles = (theme: GrafanaTheme2) => {
  const baseStyles = getInputStyles({ theme });

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
        paddingLeft: 28,

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
  };
};
