import React from 'react';
import { css } from 'emotion';
import ReactDiffViewer, { ReactDiffViewerProps, DiffMethod } from 'react-diff-viewer';
import { useTheme } from '@grafana/ui';
import tinycolor from 'tinycolor2';

export const DiffViewer: React.FC<ReactDiffViewerProps> = ({ oldValue, newValue }) => {
  const theme = useTheme();

  const styles = {
    variables: {
      // the light theme supplied by ReactDiffViewer is very similar to grafana
      // the dark theme needs some tweaks.
      dark: {
        diffViewerBackground: theme.colors.bg3,
        diffViewerColor: theme.colors.text,
        addedBackground: tinycolor(theme.palette.greenShade).setAlpha(0.75).toString(),
        addedColor: 'white',
        removedBackground: tinycolor(theme.palette.redShade).setAlpha(0.75).toString(),
        removedColor: 'white',
        wordAddedBackground: theme.palette.greenBase,
        wordRemovedBackground: theme.palette.redBase,
        addedGutterBackground: tinycolor(theme.palette.greenShade).setAlpha(0.5).toString(),
        removedGutterBackground: tinycolor(theme.palette.redShade).setAlpha(0.5).toString(),
        gutterBackground: theme.colors.bg2,
        gutterBackgroundDark: theme.colors.bg1,
        highlightBackground: theme.colors.bgBlue1,
        highlightGutterBackground: theme.colors.bgBlue2,
        codeFoldGutterBackground: theme.colors.bg2,
        codeFoldBackground: theme.colors.bg2,
        emptyLineBackground: theme.colors.bg3,
        gutterColor: theme.colors.textFaint,
        addedGutterColor: theme.colors.text,
        removedGutterColor: theme.colors.text,
        codeFoldContentColor: theme.colors.textFaint,
        diffViewerTitleBackground: theme.colors.pageHeaderBg,
        diffViewerTitleColor: theme.colors.textFaint,
        diffViewerTitleBorderColor: theme.colors.border3,
      },
    },
    codeFold: {
      fontSize: theme.typography.size.sm,
    },
  };

  return (
    <div
      className={css`
        font-size: ${theme.typography.size.sm};
        // prevent global styles interfering with diff viewer
        pre {
          all: revert;
        }
      `}
    >
      <ReactDiffViewer
        styles={styles}
        oldValue={oldValue}
        newValue={newValue}
        splitView={false}
        compareMethod={DiffMethod.CSS}
        useDarkTheme={theme.isDark}
      />
    </div>
  );
};
