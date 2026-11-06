import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Text, useStyles2 } from '@grafana/ui';

import { usePanelContext, useQueryRunnerContext } from '../QueryEditorContext';

import { ExperimentalFeedbackButton } from './ExperimentalFeedbackButton';
import { QueryOptionsBar } from './QueryOptionsBar';
import { StackedViewToggle } from './StackedViewToggle';

export function QueryEditorMainHeader() {
  const styles = useStyles2(getStyles);
  const { queries } = useQueryRunnerContext();
  const { transformations } = usePanelContext();
  const count = queries.length + transformations.length;

  return (
    <div className={styles.container}>
      <div className={styles.leftSection}>
        <StackedViewToggle />
        <Text variant="body" color="primary" weight="medium">
          {t('query-editor-next.header.showing-items', '', {
            count,
            defaultValue_one: 'Showing {{count}} item',
            defaultValue_other: 'Showing {{count}} items',
          })}
        </Text>
      </div>
      <div className={styles.rightSection}>
        <QueryOptionsBar />
        <ExperimentalFeedbackButton />
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    minHeight: theme.spacing(5),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    padding: theme.spacing(0.5, 0.5, 0.5, 1),
    backgroundColor: theme.colors.background.primary,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  leftSection: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexShrink: 0,
  }),
  rightSection: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flex: 1,
    minWidth: 0,
  }),
});
