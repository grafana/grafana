import { css } from '@emotion/css';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Card, Stack, Text, useStyles2, useTheme2 } from '@grafana/ui';
import { ExpressionQueryType, expressionTypes } from 'app/features/expressions/types';

import { EXPRESSION_IMAGE_MAP } from '../../constants';
import { useQueryEditorUIContext } from '../QueryEditorContext';

function hasDefinedValue(
  item: SelectableValue<ExpressionQueryType>
): item is SelectableValue<ExpressionQueryType> & { value: ExpressionQueryType } {
  return item.value != null;
}

export function ExpressionTypePicker() {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const { finalizePendingExpression } = useQueryEditorUIContext();

  return (
    <Stack direction="column" gap={2}>
      <Text variant="h5" weight="medium">
        {t('query-editor-next.expression-type-picker.title', 'Choose expression type')}
      </Text>
      <Stack direction="row" gap={1} wrap>
        {expressionTypes.filter(hasDefinedValue).map((item) => {
          const images = EXPRESSION_IMAGE_MAP[item.value];
          const imageUrl = theme.isDark ? images.dark : images.light;
          const label = item.label ?? '';

          return (
            <Card
              key={item.value}
              className={styles.card}
              onClick={() => finalizePendingExpression(item.value)}
              noMargin
            >
              <Card.Heading>{label}</Card.Heading>
              <Card.Description>
                <Text variant="bodySmall">{item.description ?? ''}</Text>
                <img className={styles.image} src={imageUrl} alt={label} />
              </Card.Description>
            </Card>
          );
        })}
      </Stack>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    maxWidth: 200,
    marginBottom: 0,
  }),
  image: css({
    display: 'block',
    maxWidth: '100%',
    marginTop: theme.spacing(2),
  }),
});
