import { css } from '@emotion/css';
import React from 'react';
import ReactDiffViewer, { ReactDiffViewerProps, DiffMethod } from 'react-diff-viewer';
import tinycolor from 'tinycolor2';

import { useTheme } from '@grafana/ui';

export const DiffViewer: React.FC<ReactDiffViewerProps> = ({ oldValue, newValue }) => {
  const theme = useTheme();

  const styles = {
    variables: {
      // the light theme supplied by ReactDiffViewer is very similar to Grafana
      // the dark theme needs some tweaks.
      dark: {
        diffViewerBackground: theme.colors.dashboardBg,
        diffViewerColor: theme.colors.text,
        addedBackground: tinycolor(theme.palette.greenShade).setAlpha(0.3).toString(),
        addedColor: 'white',
        removedBackground: tinycolor(theme.palette.redShade).setAlpha(0.3).toString(),
        removedColor: 'white',
        wordAddedBackground: tinycolor(theme.palette.greenBase).setAlpha(0.4).toString(),
        wordRemovedBackground: tinycolor(theme.palette.redBase).setAlpha(0.4).toString(),
        addedGutterBackground: tinycolor(theme.palette.greenShade).setAlpha(0.2).toString(),
        removedGutterBackground: tinycolor(theme.palette.redShade).setAlpha(0.2).toString(),
        gutterBackground: theme.colors.bg1,
        gutterBackgroundDark: theme.colors.bg1,
        highlightBackground: tinycolor(theme.colors.bgBlue1).setAlpha(0.4).toString(),
        highlightGutterBackground: tinycolor(theme.colors.bgBlue2).setAlpha(0.2).toString(),
        codeFoldGutterBackground: theme.colors.bg2,
        codeFoldBackground: theme.colors.bg2,
        emptyLineBackground: theme.colors.bg2,
        gutterColor: theme.colors.textFaint,
        addedGutterColor: theme.colors.text,
        removedGutterColor: theme.colors.text,
        codeFoldContentColor: theme.colors.textFaint,
        diffViewerTitleBackground: theme.colors.bg2,
        diffViewerTitleColor: theme.colors.textFaint,
        diffViewerTitleBorderColor: theme.colors.border3,
      },
    },
    codeFold: {
      fontSize: theme.typography.size.sm,
    },
    gutter: `
      pre {
        color: ${tinycolor(theme.colors.textFaint).setAlpha(1).toString()};
        opacity: 0.61;
      }
    `,
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
