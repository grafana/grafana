import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2, standardTransformersRegistry } from '@grafana/data';
import { Card, Stack, Text, useStyles2, useTheme2 } from '@grafana/ui';
import { PluginStateInfo } from 'app/features/plugins/components/PluginStateInfo';

import { useQueryEditorUIContext } from '../QueryEditorContext';

export function TransformationTypePicker() {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const { finalizePendingTransformation } = useQueryEditorUIContext();

  const allTransformations = useMemo(() => {
    const collator = new Intl.Collator();
    return standardTransformersRegistry.list().sort((a, b) => collator.compare(a.name, b.name));
  }, []);

  return (
    <div className={styles.grid}>
      {allTransformations.map((item) => {
        const imageUrl = theme.isDark ? item.imageDark : item.imageLight;

        return (
          <Card key={item.id} onClick={() => finalizePendingTransformation(item.id)} noMargin>
            <Card.Heading>
              <Stack alignItems="center" justifyContent="space-between">
                {item.name}
                <PluginStateInfo state={item.state} />
              </Stack>
            </Card.Heading>
            <Card.Description>
              <Text variant="bodySmall">{item.description ?? ''}</Text>
              {imageUrl && <img className={styles.image} src={imageUrl} alt={item.name} />}
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
    gridGap: theme.spacing(1),
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  }),
  image: css({
    display: 'block',
    maxWidth: '100%',
    marginTop: theme.spacing(2),
  }),
});
