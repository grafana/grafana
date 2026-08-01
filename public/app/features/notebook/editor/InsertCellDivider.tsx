import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Dropdown, IconButton, Menu, useStyles2 } from '@grafana/ui';

interface Props {
  onInsertText: () => void;
  onInsertCode: () => void;
}

/**
 * Notion-style hover affordance between cells: a thin line with a "+" that inserts
 * a new text or code cell at that position.
 */
export function InsertCellDivider({ onInsertText, onInsertCode }: Props) {
  const styles = useStyles2(getStyles);

  const menu = (
    <Menu>
      <Menu.Item icon="text-fields" label={t('notebooks.insert-divider.text', 'Text')} onClick={onInsertText} />
      <Menu.Item icon="brackets-curly" label={t('notebooks.insert-divider.code', 'Code')} onClick={onInsertCode} />
    </Menu>
  );

  return (
    <div className={styles.divider}>
      <div className={styles.line} />
      <Dropdown overlay={menu} placement="bottom-start">
        <IconButton
          name="plus-circle"
          size="sm"
          className={styles.button}
          tooltip={t('notebooks.insert-divider.tooltip', 'Insert block here')}
        />
      </Dropdown>
      <div className={styles.line} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  divider: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    height: theme.spacing(2),
    opacity: 0,

    '&:hover, &:focus-within': {
      opacity: 1,
    },
  }),
  line: css({
    flex: 1,
    height: 1,
    background: theme.colors.border.medium,
  }),
  button: css({
    color: theme.colors.text.secondary,
  }),
});
