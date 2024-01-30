import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getDragStyles = (theme: GrafanaTheme2) => {
  const baseColor = theme.colors.emphasize(theme.colors.background.secondary, 0.15);
  const hoverColor = theme.colors.primary.border;
  const clickTargetSize = theme.spacing(2);
  const handlebarThickness = 4;
  const handlebarWidth = 200;

  const dragHandleBase = css({
    position: 'relative',

    '&:before': {
      content: '""',
      position: 'absolute',
      transition: theme.transitions.create('border-color'),
    },

    '&:after': {
      background: baseColor,
      content: '""',
      position: 'absolute',
      left: '50%',
      top: '50%',
      transition: theme.transitions.create('background'),
      transform: 'translate(-50%, -50%)',
      borderRadius: theme.shape.radius.pill,
    },

    '&:hover': {
      '&:before': {
        borderColor: hoverColor,
      },

      '&:after': {
        background: hoverColor,
      },
    },
  });

  return {
    dragHandleVertical: cx(
      dragHandleBase,
      css({
        cursor: 'col-resize',
        width: clickTargetSize,

        '&:before': {
          borderRight: '1px solid transparent',
          height: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
        },

        '&:after': {
          height: handlebarWidth,
          width: handlebarThickness,
        },
      })
    ),
    dragHandleHorizontal: cx(
      dragHandleBase,
      css({
        height: clickTargetSize,
        cursor: 'row-resize',

        '&:before': {
          borderTop: '1px solid transparent',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '100%',
        },

        '&:after': {
          height: handlebarThickness,
          width: handlebarWidth,
        },
      })
    ),
  };
};
