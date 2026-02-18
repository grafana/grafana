import { css } from '@emotion/css';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Card, Text, useStyles2, useTheme2 } from '@grafana/ui';
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
    <div className={styles.grid}>
      {expressionTypes.filter(hasDefinedValue).map((item) => {
        const image = EXPRESSION_IMAGE_MAP[item.value];
        const imageUrl = theme.isDark ? image.dark : image.light;
        const label = item.label ?? '';

        return (
          <Card key={item.value} onClick={() => finalizePendingExpression(item.value)} noMargin>
            <Card.Heading>{label}</Card.Heading>
            <Card.Description>
              <Text variant="bodySmall">{item.description ?? ''}</Text>
              <img className={styles.image} src={imageUrl} alt={label} />
            </Card.Description>
          </Card>
        );
      })}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  grid: css({
    display: 'grid',
    gap: theme.spacing(1),
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  }),
  image: css({
    display: 'block',
    maxWidth: '100%',
    marginTop: theme.spacing(2),
  }),
});
