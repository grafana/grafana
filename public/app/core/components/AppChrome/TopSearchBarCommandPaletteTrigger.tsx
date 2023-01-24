import { css } from '@emotion/css';
import { useKBar, VisualState } from 'kbar';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { getInputStyles, Icon, ToolbarButton, useStyles2, useTheme2 } from '@grafana/ui';
import { focusCss } from '@grafana/ui/src/themes/mixins';
import { useMediaQueryChange } from 'app/core/hooks/useMediaQueryChange';
import { t } from 'app/core/internationalization';

export function TopSearchBarCommandPaletteTrigger() {
  const theme = useTheme2();
  const { query: kbar } = useKBar((kbarState) => ({
    kbarSearchQuery: kbarState.searchQuery,
    kbarIsOpen: kbarState.visualState === VisualState.showing,
  }));

  const breakpoint = theme.breakpoints.values.sm;

  const [isSmallScreen, setIsSmallScreen] = useState(window.matchMedia(`(max-width: ${breakpoint}px)`).matches);

  useMediaQueryChange({
    breakpoint,
    onChange: (e) => {
      setIsSmallScreen(e.matches);
    },
  });

  const onOpenSearch = () => {
    kbar.toggle();
  };

  if (isSmallScreen) {
    return (
      <ToolbarButton
        iconOnly
        icon="search"
        aria-label={t('nav.search.placeholder', 'Search Grafana')}
        onClick={onOpenSearch}
      />
    );
  }

  return <PretendTextInput onClick={onOpenSearch} />;
}

function PretendTextInput({ onClick }: { onClick: () => void }) {
  const styles = useStyles2(getStyles);

  // We want the desktop command palette trigger to look like a search box,
  // but it actually behaves like a button - you active it and it performs an
  // action. You don't actually type into it.

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputWrapper}>
        <div className={styles.prefix}>
          <Icon name="search" />
        </div>

        <button className={styles.fakeInput} onClick={onClick}>
          {t('nav.search.placeholder', 'Search Grafana')}
        </button>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const baseStyles = getInputStyles({ theme });

  return {
    wrapper: baseStyles.wrapper,
    inputWrapper: baseStyles.inputWrapper,
    prefix: baseStyles.prefix,
    fakeInput: css([
      baseStyles.input,
      {
        textAlign: 'left',
        paddingLeft: 28,
        color: theme.colors.text.disabled,

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

    button: css({
      // height: 32,
      width: '100%',
      textAlign: 'center',

      '> *': {
        width: '100%',
        textAlign: 'center',
        justifyContent: 'center',
        gap: '1ch',
      },
    }),
  };
};
