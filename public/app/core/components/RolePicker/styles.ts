import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

import {
  ROLE_PICKER_MENU_MAX_WIDTH,
  ROLE_PICKER_MENU_MIN_WIDTH,
  ROLE_PICKER_SUBMENU_MAX_WIDTH,
  ROLE_PICKER_SUBMENU_MIN_WIDTH,
} from './constants';

export const getStyles = (theme: GrafanaTheme2) => ({
  hideScrollBar: css({
    '.scrollbar-view': {
      /* Hide scrollbar for Chrome, Safari, and Opera */
      '&::-webkit-scrollbar': {
        display: 'none',
      },
      /* Hide scrollbar for Firefox */
      scrollbarWidth: 'none',
    },
  }),
  menuWrapper: css({
    display: 'flex',
    maxHeight: '650px',
    position: 'absolute',
    zIndex: theme.zIndex.dropdown,
    overflow: 'hidden',
    minWidth: 'auto',
  }),
  menu: css({
    minWidth: `${ROLE_PICKER_MENU_MIN_WIDTH}px`,
    maxWidth: `${ROLE_PICKER_MENU_MAX_WIDTH}px`,
    '& > div': {
      paddingTop: theme.spacing(1),
    },
  }),
  menuLeft: css({
    flexDirection: 'row-reverse',
  }),
  subMenu: css({
    height: '100%',
    minWidth: `${ROLE_PICKER_SUBMENU_MIN_WIDTH}px`,
    maxWidth: `${ROLE_PICKER_SUBMENU_MAX_WIDTH}px`,
    display: 'flex',
    flexDirection: 'column',
    borderLeft: `1px solid ${theme.components.input.borderColor}`,

    '& > div': {
      paddingTop: theme.spacing(1),
    },
  }),
  subMenuLeft: css({
    borderRight: `1px solid ${theme.components.input.borderColor}`,
    borderLeft: 'unset',
  }),
  groupHeader: css({
    padding: theme.spacing(0, 4.5),
    display: 'flex',
    alignItems: 'center',
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeightBold,
  }),
  container: css({
    padding: theme.spacing(1),
    border: `1px ${theme.colors.border.weak} solid`,
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.background.primary,
    zIndex: theme.zIndex.modal,
  }),
  menuSection: css({
    marginBottom: theme.spacing(2),
  }),
  menuOptionCheckbox: css({
    display: 'flex',
    margin: theme.spacing(0, 1, 0, 0.25),
  }),
  menuButtonRow: css({
    backgroundColor: theme.colors.background.primary,
    padding: theme.spacing(1),
  }),
  menuOptionBody: css({
    fontWeight: theme.typography.fontWeightRegular,
    padding: theme.spacing(0, 1.5, 0, 0),
  }),
  menuOptionDisabled: css({
    color: theme.colors.text.disabled,
    cursor: 'not-allowed',
  }),
  menuOptionExpand: css({
    position: 'absolute',
    right: theme.spacing(2.5),
    color: theme.colors.text.disabled,

    '&:after': {
      content: '">"',
    },
  }),
  menuOptionInfoSign: css({
    color: theme.colors.text.disabled,
  }),
  basicRoleSelector: css({
    margin: theme.spacing(1, 1.25, 1, 1.5),
  }),
  subMenuPortal: css({
    height: '100%',
    '> div': {
      height: '100%',
    },
  }),
  subMenuButtonRow: css({
    backgroundColor: theme.colors.background.primary,
    padding: theme.spacing(1),
  }),
  checkboxPartiallyChecked: css({
    input: {
      '&:checked + span': {
        '&:after': {
          borderWidth: '0 3px 0px 0',
          transform: 'rotate(90deg)',
        },
      },
    },
  }),
  loadingSpinner: css({
    marginLeft: theme.spacing(1),
  }),
  menuOptionInherited: css({
    opacity: 0.7,
    cursor: 'default',
  }),
  menuOptionExpandBtn: css({
    marginLeft: 'auto',
    padding: theme.spacing(0, 0.5),
    cursor: 'pointer',
    color: theme.colors.text.secondary,
    background: 'none',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
  permissionsAccordion: css({
    borderTop: `1px solid ${theme.colors.border.weak}`,
    backgroundColor: theme.colors.background.secondary,
    padding: theme.spacing(1, 1.5),
    maxHeight: '200px',
    overflowY: 'auto' as const,
  }),
  permissionsHeader: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(0.5),
  }),
  permissionsCount: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  permissionRow: css({
    padding: theme.spacing(0, 0, 0, 0.5),
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    lineHeight: 1.5,
  }),
  permissionsLoading: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.disabled,
    fontStyle: 'italic',
    padding: theme.spacing(0.5),
  }),
  permissionsEmpty: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.disabled,
    padding: theme.spacing(0.5),
  }),
  inheritedBadge: css({
    fontSize: '10px',
    color: theme.colors.text.disabled,
    fontStyle: 'italic',
    marginLeft: theme.spacing(0.5),
  }),
  orphanSection: css({
    marginBottom: theme.spacing(2),
  }),
  orphanHeader: css({
    padding: theme.spacing(0, 4.5),
    display: 'flex',
    alignItems: 'center',
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeightBold,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
