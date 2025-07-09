import { css } from '@emotion/css';

import { GrafanaTheme2, renderMarkdown } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Drawer, useStyles2, Stack, Card } from '@grafana/ui';

interface AIExplanationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  explanation: string;
}

export const AIExplanationDrawer = ({ isOpen, onClose, explanation }: AIExplanationDrawerProps) => {
  const styles = useStyles2(getStyles);

  if (!isOpen) {
    return null;
  }

  return (
    <Drawer
      onClose={onClose}
      size="md"
      title={<Trans i18nKey="sql-expressions.explanation-modal-title">SQL Query Explanation</Trans>}
    >
      <div className={styles.content}>
        <Stack direction="column" gap={3}>
          <div className={styles.explanationContainer}>
            <Card noMargin>
              <div className="markdown-html" dangerouslySetInnerHTML={{ __html: renderMarkdown(explanation) }} />
            </Card>
          </div>
        </Stack>
      </div>
    </Drawer>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  content: css({
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  }),
  explanationContainer: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    overflow: 'auto',
    flex: 1,
  }),
});
