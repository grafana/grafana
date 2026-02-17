import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, Card, Stack, useStyles2 } from '@grafana/ui';
import {
  EditableVariableType,
  getEditableVariables,
} from 'app/features/dashboard-scene/settings/variables/utils';

const EXPLORE_VARIABLE_TYPES: EditableVariableType[] = ['custom', 'query', 'textbox', 'constant'];

interface Props {
  onSelect: (type: EditableVariableType) => void;
  onCancel: () => void;
}

export function ExploreVariableTypeSelection({ onSelect, onCancel }: Props) {
  const styles = useStyles2(getStyles);
  const editableVariables = getEditableVariables();

  return (
    <div className={styles.container}>
      <Stack direction="column" gap={1}>
        {EXPLORE_VARIABLE_TYPES.map((type) => {
          const config = editableVariables[type];
          return (
            <Card key={type} onClick={() => onSelect(type)} className={styles.card} noMargin>
              <Card.Heading>{config.name}</Card.Heading>
              <Card.Description>{config.description}</Card.Description>
            </Card>
          );
        })}
      </Stack>
      <div className={styles.footer}>
        <Button variant="secondary" onClick={onCancel}>
          <Trans i18nKey="explore.variable-type-selection.cancel">Cancel</Trans>
        </Button>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),
  card: css({
    cursor: 'pointer',
  }),
  footer: css({
    marginTop: theme.spacing(2),
  }),
});
