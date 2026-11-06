import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { CardEditorRenderer } from '../CardEditorRenderer';
import { ContentHeaderSceneWrapper } from '../Header/ContentHeader';
import { DatasourceHelpPanel } from '../Header/DatasourceHelpPanel';
import { useQueryEditorUIContext } from '../QueryEditorContext';

export function SingleEditorCard() {
  const styles = useStyles2(getStyles);
  const { showingDatasourceHelp, pendingExpression, pendingTransformation } = useQueryEditorUIContext();
  const hasPendingPicker = !!pendingExpression || !!pendingTransformation;

  return (
    <section className={styles.card}>
      <ContentHeaderSceneWrapper />
      {showingDatasourceHelp && !hasPendingPicker && <DatasourceHelpPanel />}
      <div className={styles.body}>
        <CardEditorRenderer />
      </div>
    </section>
  );
}

// Matches StackedSection/StackedItem so a single card looks like one card of the stack.
const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.primary,
    overflow: 'hidden',
  }),
  body: css({
    padding: theme.spacing(2),
  }),
});
