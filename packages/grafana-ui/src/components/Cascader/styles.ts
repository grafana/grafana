import { css, keyframes } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

const slideUpIn = keyframes({
  '0%': {
    opacity: 0,
    transformOrigin: '0% 0%',
    transform: 'scaleY(0.8)',
  },

  '100%': {
    opacity: 1,
    transformOrigin: '0% 0%',
    transform: 'scaleY(1)',
  },
});

const slideUpOut = keyframes({
  '0%': {
    opacity: 1,
    transformOrigin: '0% 0%',
    transform: 'scaleY(1)',
  },

  '100%': {
    opacity: 0,
    transformOrigin: '0% 0%',
    transform: 'scaleY(0.8)',
  },
});

const slideDownIn = keyframes({
  '0%': {
    opacity: 0,
    transformOrigin: '0% 100%',
    transform: 'scaleY(0.8)',
  },

  '100%': {
    opacity: 1,
    transformOrigin: '0% 100%',
    transform: 'scaleY(1)',
  },
});

const slideDownOut = keyframes({
  '0%': {
    opacity: 1,
    transformOrigin: '0% 100%',
    transform: 'scaleY(1)',
  },

  '100%': {
    opacity: 0,
    transformOrigin: '0% 100%',
    transform: 'scaleY(0.8)',
  },
});

export const getCascaderStyles = (theme: GrafanaTheme2) => ({
  dropdown: css({
    '&.rc-cascader-dropdown': {
      position: 'absolute',
      // Required, otherwise the portal that the popup is shown in will render under other components
      zIndex: 9999,

      '&-hidden': {
        display: 'none',
      },
    },
    '.rc-cascader': {
      '&-menus': {
        overflow: 'hidden',
        background: theme.colors.background.elevated,
        border: `none`,
        borderRadius: theme.shape.radius.default,
        boxShadow: theme.shadows.z3,
        whiteSpace: 'nowrap',

        '&.slide-up-enter, &.slide-up-appear': {
          animationDuration: '0.3s',
          animationFillMode: 'both',
          transformOrigin: '0 0',
          opacity: 0,
          animationTimingFunction: 'cubic-bezier(0.08, 0.82, 0.17, 1)',
          animationPlayState: 'paused',
        },

        '&.slide-up-enter.slide-up-enter-active.rc-cascader-menus-placement, &.slide-up-appear.slide-up-appear-active.rc-cascader-menus-placement':
          {
            '&-bottomLeft': {
              animationName: slideUpIn,
              animationPlayState: 'running',
            },

            '&-topLeft': {
              animationName: slideDownIn,
              animationPlayState: 'running',
            },
          },

        '&.slide-up-leave': {
          animationDuration: '0.3s',
          animationFillMode: 'both',
          transformOrigin: '0 0',
          opacity: 1,
          animationTimingFunction: 'cubic-bezier(0.6, 0.04, 0.98, 0.34)',
          animationPlayState: 'paused',

          '&.slide-up-leave-active.rc-cascader-menus-placement': {
            '&-bottomLeft': {
              animationName: slideUpOut,
              animationPlayState: 'running',
            },

            '&-topLeft': {
              animationName: slideDownOut,
              animationPlayState: 'running',
            },
          },
        },
      },

      '&-menu': {
        display: 'inline-block',
        maxWidth: '50vw',
        height: '192px',
        listStyle: 'none',
        margin: 0,
        padding: theme.spacing(0.5),
        borderRight: `1px solid ${theme.colors.border.weak}`,
        overflow: 'auto',

        '&:last-child': {
          borderRight: 0,
        },

        '&-item': {
          height: theme.spacing(4),
          lineHeight: theme.spacing(4),
          padding: theme.spacing(0, 4, 0, 2),
          borderRadius: theme.shape.radius.default,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          transition: 'all 0.3s ease',
          position: 'relative',

          '&:hover': {
            background: theme.colors.action.hover,
          },

          '&-disabled': {
            cursor: 'not-allowed',
            color: theme.colors.text.disabled,

            '&:hover': {
              background: 'transparent',
            },

            '&:after': {
              position: 'absolute',
              right: '12px',
              content: "'loading'",
              color: theme.colors.text.disabled,
              fontStyle: 'italic',
            },
          },

          '&-active': {
            color: theme.colors.text.maxContrast,
            background: theme.colors.background.secondary,

            '&:hover': {
              background: theme.colors.action.hover,
            },
          },

          '&-expand': {
            position: 'relative',

            '&:after': {
              background: theme.colors.background.secondary,
              content: "''",
              height: theme.spacing(3),
              mask: 'url(../img/icons/unicons/angle-right.svg)',
              maskType: 'luminance',
              position: 'absolute',
              right: 0,
              top: theme.spacing(0.5),
              width: theme.spacing(3),
            },
          },
        },
      },
    },
  }),
});
