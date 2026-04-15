import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Text, useStyles2 } from '@grafana/ui';
import { NavToolbarSeparator } from 'app/core/components/AppChrome/NavToolbar/NavToolbarSeparator';

import { type QueryEditorType } from '../constants';

import { getEditorBorderColor } from './utils';

interface StackedItemShellProps {
  editorType: QueryEditorType;
  icon: ReactNode;
  label: string;
  name: string;
  isHidden?: boolean;
  children: ReactNode;
}

export function StackedItemShell({ editorType, icon, label, name, isHidden, children }: StackedItemShellProps) {
  const styles = useStyles2(getStyles, editorType);

  return (
    <div className={styles.item} role="article" aria-label={name}>
      <div className={styles.header}>
        {icon}
        <Text variant="body" color="primary">
          {label}
        </Text>
        <NavToolbarSeparator />
        <Text variant="code" weight="medium" color="primary">
          {name}
        </Text>
        {isHidden && <Icon name="eye-slash" size="sm" title={t('query-editor-next.stacked-view.hidden', 'Hidden')} />}
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, editorType: QueryEditorType) => {
  const borderColor = getEditorBorderColor({ theme, editorType });

  return {
    item: css({
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
      position: 'relative',

      '&::before': {
        content: '""',
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        background: borderColor,
        borderTopLeftRadius: theme.shape.radius.default,
        borderBottomLeftRadius: theme.shape.radius.default,
      },
    }),
    header: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      backgroundColor: theme.colors.background.secondary,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      minHeight: theme.spacing(5),
      padding: theme.spacing(0, 1.5),
      paddingLeft: `calc(${theme.spacing(1.5)} + 4px)`,
    }),
    body: css({
      padding: theme.spacing(1.5),
    }),
  };
};
