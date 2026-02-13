import { Trans } from '@grafana/i18n';
import { Button, useStyles2, Icon, Text } from '@grafana/ui';

import { QUERY_EDITOR_TYPE_CONFIG, QueryEditorType } from '../../constants';
import { useQueryEditorUIContext } from '../QueryEditorContext';

import { getContentHeaderStyles } from './ContentHeader';

export function PendingExpressionHeader() {
  const styles = useStyles2(getContentHeaderStyles, { cardType: QueryEditorType.Expression });
  const { setPendingExpression } = useQueryEditorUIContext();

  return (
    <div className={styles.container}>
      <div className={styles.leftSection}>
        <Icon name={QUERY_EDITOR_TYPE_CONFIG[QueryEditorType.Expression].icon} size="sm" />
        <Text weight="light" variant="body" color="secondary">
          <Trans i18nKey="query-editor-next.header.pending-expression">Select an Expression</Trans>
        </Text>
      </div>
      <Button variant="secondary" fill="text" size="sm" icon="times" onClick={() => setPendingExpression(null)}>
        <Trans i18nKey="query-editor-next.header.pending-expression-cancel">Cancel</Trans>
      </Button>
    </div>
  );
}
