import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Text, useStyles2 } from '@grafana/ui';

import { useQueryEditorUIContext } from './QueryEditorContext';

export function QueryEditorContent() {
  const styles = useStyles2(getStyles);

  const { selectedQueryRefId } = useQueryEditorUIContext();
  return (
    <div className={styles.container}>
      <Text color="secondary">
        {t('query-editor-next.detail-placeholder', 'Query/Transform detail view goes here')}
        {selectedQueryRefId}
      </Text>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      height: '100%',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing(2),
    }),
  };
}
