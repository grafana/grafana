import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getGlobalStyles(theme: GrafanaTheme2) {
  return css({
    '.moveable-control-box': {
      zIndex: 999,
    },
    '.rc-tree': {
      margin: 0,
      marginBottom: '15px',
      border: '1px solid transparent',
      '&-focused:not(&-active-focused)': {
        borderColor: 'cyan',
      },
      '.rc-tree-title': {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
      },
      '.rc-tree-treenode': {
        margin: 0,
        padding: '1px',
        lineHeight: '24px',
        whiteSpace: 'nowrap',
        listStyle: 'none',
        outline: 0,
        display: 'flex',
        marginBottom: '3px',
        cursor: 'pointer',
        '.draggable': {
          color: '#333',
          MozUserSelect: 'none',
          KhtmlUserSelect: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
        },
        '&.drop-container': {
          '> .draggable::after': {
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            boxShadow: 'inset 0 0 0 2px blue',
            content: '""',
          },
          '& ~ .rc-tree-treenode': {
            borderLeft: `2px solid ${theme.components.input.borderColor}`,
          },
        },
        '&.drop-target': {
          '& ~ .rc-tree-treenode': {
            borderLeft: 'none',
          },
        },
        '&.filter-node': {
          '> .rc-tree-node-content-wrapper': {
            color: '#a60000 !important',
            fontWeight: 'bold !important',
          },
        },
        ul: {
          margin: 0,
          padding: '0 0 0 18px',
        },
        '.rc-tree-node-content-wrapper': {
          position: 'relative',
          display: 'inline-block',
          height: '24px',
          margin: 0,
          padding: 0,
          textDecoration: 'none',
          verticalAlign: 'top',
          cursor: 'grab',
          flexGrow: 1,
          border: `1px solid ${theme.components.input.borderColor}`,
          borderRadius: `${theme.shape.radius.default}`,
          background: `${theme.colors.background.secondary}`,
          minHeight: `${theme.spacing.gridSize * 4}px`,
          '&:hover': {
            border: `1px solid ${theme.components.input.borderHover}`,
          },
          '&.rc-tree-node-selected': {
            border: `1px solid ${theme.colors.primary.border}`,
            opacity: 1,
          },
        },
        span: {
          height: '100%',
          '&.rc-tree-checkbox, &.rc-tree-iconEle': {
            display: 'inline-block',
            width: '16px',
            height: '16px',
            marginRight: '2px',
            lineHeight: '16px',
            verticalAlign: '-0.125em',
            backgroundColor: 'transparent',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'scroll',
            border: '0 none',
            outline: 'none',
            cursor: 'pointer',
            '&.rc-tree-icon__customize': {
              backgroundImage: 'none',
            },
          },
          '&.rc-tree-switcher': {
            display: 'flex',
            alignItems: 'center',
            width: '16px',
            height: 'auto',
            backgroundColor: 'transparent',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'scroll',
            border: '0 none',
            outline: 'none',
            cursor: 'pointer',
            '&.rc-tree-icon__customize': {
              backgroundImage: 'none',
            },
            '&.rc-tree-switcher-noop': {
              cursor: 'auto',
            },
            '&.rc-tree-switcher_open': {
              backgroundPosition: '-93px -56px',
            },
            '&.rc-tree-switcher_close': {
              backgroundPosition: '-75px -56px',
            },
          },
          '&.rc-tree-icon_loading': {
            marginRight: '2px',
            verticalAlign: 'top',
            background:
              "url('data:image/gif;base64,R0lGODlhEAAQAKIGAMLY8YSx5HOm4Mjc88/g9Ofw+v///wAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQFCgAGACwAAAAAEAAQAAADMGi6RbUwGjKIXCAA016PgRBElAVlG/RdLOO0X9nK61W39qvqiwz5Ls/rRqrggsdkAgAh+QQFCgAGACwCAAAABwAFAAADD2hqELAmiFBIYY4MAutdCQAh+QQFCgAGACwGAAAABwAFAAADD1hU1kaDOKMYCGAGEeYFCQAh+QQFCgAGACwKAAIABQAHAAADEFhUZjSkKdZqBQG0IELDQAIAIfkEBQoABgAsCgAGAAUABwAAAxBoVlRKgyjmlAIBqCDCzUoCACH5BAUKAAYALAYACgAHAAUAAAMPaGpFtYYMAgJgLogA610JACH5BAUKAAYALAIACgAHAAUAAAMPCAHWFiI4o1ghZZJB5i0JACH5BAUKAAYALAAABgAFAAcAAAMQCAFmIaEp1motpDQySMNFAgA7') no-repeat scroll 0 0 transparent",
          },
          '&.rc-tree-checkbox': {
            width: '13px',
            height: '13px',
            margin: '0 3px',
            backgroundPosition: '0 0',
            '&-checked': {
              backgroundPosition: '-14px 0',
            },
            '&-indeterminate': {
              backgroundPosition: '-14px -28px',
            },
            '&-disabled': {
              backgroundPosition: '0 -56px',
            },
            '&.rc-tree-checkbox-checked.rc-tree-checkbox-disabled': {
              backgroundPosition: '-14px -56px',
            },
            '&.rc-tree-checkbox-indeterminate.rc-tree-checkbox-disabled': {
              position: 'relative',
              background: '#ccc',
              borderRadius: theme.shape.radius.default,
              '&::after': {
                position: 'absolute',
                top: '5px',
                left: '3px',
                width: '5px',
                height: 0,
                border: '2px solid #fff',
                borderTop: 0,
                borderLeft: 0,
                WebkitTransform: 'scale(1)',
                transform: 'scale(1)',
                content: '" "',
              },
            },
          },
        },
      },
      '&:not(.rc-tree-show-line)': {
        '.rc-tree-treenode': {
          '.rc-tree-switcher-noop': {
            background: 'none',
          },
        },
      },
      '&.rc-tree-show-line': {
        '.rc-tree-treenode:not(:last-child)': {
          '> ul': {
            background:
              "url('data:image/gif;base64,R0lGODlhCQACAIAAAMzMzP///yH5BAEAAAEALAAAAAAJAAIAAAIEjI9pUAA7') 0 0 repeat-y",
          },
          '> .rc-tree-switcher-noop': {
            backgroundPosition: '-56px -18px',
          },
        },
        '.rc-tree-treenode:last-child': {
          '> .rc-tree-switcher-noop': {
            backgroundPosition: '-56px -36px',
          },
        },
      },
      '&-child-tree': {
        display: 'none',
        '&-open': {
          display: 'block',
        },
      },
      '&-treenode-disabled': {
        '> span:not(.rc-tree-switcher), > a, > a span': {
          color: '#767676',
          cursor: 'not-allowed',
        },
      },
      '&-treenode-active': {
        background: 'rgba(0, 0, 0, 0.1)',
      },
      '&-node-selected': {
        opacity: 0.8,
      },
      '&-icon__open': {
        marginRight: '2px',
        verticalAlign: 'top',
        backgroundPosition: '-110px -16px',
      },
      '&-icon__close': {
        marginRight: '2px',
        verticalAlign: 'top',
        backgroundPosition: '-110px 0',
      },
      '&-icon__docu': {
        marginRight: '2px',
        verticalAlign: 'top',
        backgroundPosition: '-110px -32px',
      },
      '&-icon__customize': {
        marginRight: '2px',
        verticalAlign: 'top',
      },
      '&-title': {
        display: 'inline-block',
      },
      '&-indent': {
        display: 'inline-block',
        height: 0,
        verticalAlign: 'bottom',
      },
      '&-indent-unit': {
        display: 'inline-block',
        width: '16px',
      },
      '&-draggable-icon': {
        display: 'inline-flex',
        justifyContent: 'center',
        width: '16px',
      },
    },
  });
}
