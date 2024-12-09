import { css } from '@emotion/css';
import ReactDiffViewer, { ReactDiffViewerProps, DiffMethod } from 'react-diff-viewer-continued';
import tinycolor from 'tinycolor2';

import { useTheme2 } from '@grafana/ui';

export const DiffViewer = ({ oldValue, newValue, ...diffProps }: ReactDiffViewerProps) => {
  const theme = useTheme2();

  const styles = {
    variables: {
      // the light theme supplied by ReactDiffViewer is very similar to Grafana
      // the dark theme needs some tweaks.
      dark: {
        diffViewerBackground: theme.colors.background.canvas,
        diffViewerColor: theme.colors.text.primary,
        addedBackground: tinycolor(theme.v1.palette.greenShade).setAlpha(0.3).toString(),
        addedColor: 'white',
        removedBackground: tinycolor(theme.v1.palette.redShade).setAlpha(0.3).toString(),
        removedColor: 'white',
        wordAddedBackground: tinycolor(theme.v1.palette.greenBase).setAlpha(0.4).toString(),
        wordRemovedBackground: tinycolor(theme.v1.palette.redBase).setAlpha(0.4).toString(),
        addedGutterBackground: tinycolor(theme.v1.palette.greenShade).setAlpha(0.2).toString(),
        removedGutterBackground: tinycolor(theme.v1.palette.redShade).setAlpha(0.2).toString(),
        gutterBackground: theme.colors.background.primary,
        gutterBackgroundDark: theme.colors.background.primary,
        highlightBackground: tinycolor(theme.colors.primary.main).setAlpha(0.4).toString(),
        highlightGutterBackground: tinycolor(theme.colors.primary.shade).setAlpha(0.2).toString(),
        codeFoldGutterBackground: theme.colors.background.secondary,
        codeFoldBackground: theme.colors.background.secondary,
        emptyLineBackground: theme.colors.background.secondary,
        gutterColor: theme.colors.text.disabled,
        addedGutterColor: theme.colors.text.primary,
        removedGutterColor: theme.colors.text.primary,
        codeFoldContentColor: theme.colors.text.disabled,
        diffViewerTitleBackground: theme.colors.background.secondary,
        diffViewerTitleColor: theme.colors.text.disabled,
        diffViewerTitleBorderColor: theme.colors.border.strong,
      },
    },
    codeFold: {
      fontSize: theme.typography.bodySmall.fontSize,
    },
    gutter: {
      pre: {
        color: tinycolor(theme.colors.text.disabled).setAlpha(1).toString(),
        opacity: 0.61,
      },
    },
  };

  return (
    <div
      className={css({
        fontSize: theme.typography.bodySmall.fontSize,
        // prevent global styles interfering with diff viewer
        pre: {
          all: 'revert',
        },
      })}
    >
      <ReactDiffViewer
        styles={styles}
        oldValue={oldValue}
        newValue={newValue}
        splitView={false}
        compareMethod={DiffMethod.CSS}
        useDarkTheme={theme.isDark}
        {...diffProps}
      />
    </div>
  );
};
