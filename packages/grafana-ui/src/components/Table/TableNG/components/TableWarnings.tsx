import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { Icon } from '../../../Icon/Icon';
import { Tooltip } from '../../../Tooltip/Tooltip';
import { type TableWarning } from '../types';

interface Props {
  warnings: readonly TableWarning[];
  scope: 'field' | 'cell';
  alignRight?: boolean;
}

export function TableWarnings({ warnings, scope, alignRight = false }: Props) {
  const styles = useStyles2(getStyles, alignRight);
  if (warnings.length === 0) {
    return null;
  }

  return (
    <Tooltip content={<TableWarningContent warnings={warnings} />}>
      <button
        type="button"
        className={styles.marker}
        aria-label={
          scope === 'field'
            ? t('grafana-ui.table.field-warnings', 'Field warnings')
            : t('grafana-ui.table.cell-warnings', 'Cell warnings')
        }
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.stopPropagation();
          }
        }}
      />
    </Tooltip>
  );
}

export function TableWarningContent({ warnings }: { warnings: readonly TableWarning[] }) {
  const styles = useStyles2(getStyles, false);
  return (
    <div className={styles.content}>
      <Icon name="exclamation-triangle" size="sm" className={styles.icon} />
      <div className={styles.messages}>
        {warnings.length === 1 ? (
          warnings[0].message
        ) : (
          <ul className={styles.list}>
            {warnings.map(({ id, message }) => (
              <li key={id}>{message}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, alignRight: boolean) => ({
  content: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.warning.subtleBackground,
    color: theme.colors.text.primary,
    textAlign: 'left',
    whiteSpace: 'normal',
  }),
  icon: css({
    color: theme.colors.warning.text,
    flexShrink: 0,
    marginTop: theme.spacing(0.25),
  }),
  messages: css({ minWidth: 0, overflowWrap: 'anywhere' }),
  marker: css({
    position: 'absolute',
    top: theme.spacing(0.25),
    [alignRight ? 'right' : 'left']: theme.spacing(0.25),
    width: theme.spacing(1.75),
    height: theme.spacing(1.75),
    padding: 0,
    border: 0,
    background: `linear-gradient(to top ${alignRight ? 'right' : 'left'}, transparent 62.5%, ${theme.colors.warning.main} 50%)`,
    cursor: 'help',
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: 1,
    },
  }),
  list: css({ margin: 0, paddingInlineStart: theme.spacing(2) }),
});
