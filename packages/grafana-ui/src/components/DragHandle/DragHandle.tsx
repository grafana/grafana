import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export type DragHandlePosition = 'middle' | 'start' | 'end';

export const getDragStyles = (theme: GrafanaTheme2, handlePosition?: DragHandlePosition) => {
  const position = handlePosition || 'middle';
  const baseColor = theme.colors.emphasize(theme.colors.background.secondary, 0.15);
  const hoverColor = theme.colors.primary.border;
  const clickTargetSize = theme.spacing(2);
  const handlebarThickness = 4;
  const handlebarWidth = 200;
  let verticalOffset = '50%';
  let horizontalOffset = '50%';

  switch (position) {
    case 'start': {
      verticalOffset = '0%';
      horizontalOffset = '0%';
      break;
    }
    case 'end': {
      verticalOffset = '100%';
      horizontalOffset = '100%';
      break;
    }
  }

  const dragHandleBase = css({
    position: 'relative',

    '&:before': {
      content: '""',
      position: 'absolute',
      transition: theme.transitions.create('border-color'),
      zIndex: 1,
    },

    '&:after': {
      background: baseColor,
      content: '""',
      position: 'absolute',
      transition: theme.transitions.create('background'),
      transform: 'translate(-50%, -50%)',
      borderRadius: theme.shape.radius.pill,
      zIndex: 1,
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

  const beforeVertical = {
    borderRight: '1px solid transparent',
    height: '100%',
    left: verticalOffset,
    transform: 'translateX(-50%)',
  };

  const beforeHorizontal = {
    borderTop: '1px solid transparent',
    top: horizontalOffset,
    transform: 'translateY(-50%)',
  };

  return {
    dragHandleVertical: cx(
      dragHandleBase,
      css({
        cursor: 'col-resize',
        width: clickTargetSize,

        '&:before': beforeVertical,

        '&:after': {
          left: verticalOffset,
          top: '50%',
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

        '&:before': beforeHorizontal,

        '&:after': {
          left: '50%',
          top: horizontalOffset,
          height: handlebarThickness,
          width: handlebarWidth,
        },
      })
    ),
    dragHandleBaseVertical: cx(
      dragHandleBase,
      css({
        cursor: 'col-resize',
        width: clickTargetSize,

        '&:before': beforeVertical,
      })
    ),
    dragHandleBaseHorizontal: cx(
      dragHandleBase,
      css({
        cursor: 'row-resize',
        height: clickTargetSize,

        '&:before': beforeHorizontal,
      })
    ),
  };
};
