import { renderMarkdown } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Drawer, Stack, Card } from '@grafana/ui';

interface AIExplanationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  explanation: string;
}

export const GenAIExplanationDrawer = ({ isOpen, onClose, explanation }: AIExplanationDrawerProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <Drawer
      onClose={onClose}
      size="md"
      title={<Trans i18nKey="sql-expressions.explanation-modal-title">SQL Query Explanation</Trans>}
    >
      <Stack direction="column" data-testid="explanation-drawer">
        <Card noMargin>
          <div className="markdown-html" dangerouslySetInnerHTML={{ __html: renderMarkdown(explanation) }} />
        </Card>
      </Stack>
    </Drawer>
  );
};
