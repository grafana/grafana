import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Text, useStyles2 } from '@grafana/ui';

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
    <div className={styles.item}>
      <div className={styles.header}>
        {icon}
        <Text variant="code" color="maxContrast">
          {label}
        </Text>
        <Text variant="code" weight="medium" color="info">
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
        width: 3,
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
      height: theme.spacing(4),
      padding: theme.spacing(0, 1.5),
    }),
    body: css({
      padding: theme.spacing(1.5),
    }),
  };
};
