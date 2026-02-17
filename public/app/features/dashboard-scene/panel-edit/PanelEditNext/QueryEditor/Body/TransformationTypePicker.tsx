import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2, standardTransformersRegistry } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { TransformationCard } from 'app/features/dashboard/components/TransformationsEditor/TransformationCard';

import { useQueryEditorUIContext, useQueryRunnerContext } from '../QueryEditorContext';

export function TransformationTypePicker() {
  const styles = useStyles2(getStyles);
  const { finalizePendingTransformation } = useQueryEditorUIContext();
  const { data } = useQueryRunnerContext();

  const allTransformations = useMemo(() => {
    const collator = new Intl.Collator();
    return standardTransformersRegistry.list().sort((a, b) => collator.compare(a.name, b.name));
  }, []);

  return (
    <div className={styles.grid}>
      {allTransformations.map((item) => (
        <TransformationCard
          key={item.id}
          transform={item}
          data={data?.series}
          onClick={finalizePendingTransformation}
          showIllustrations
          fullWidth
        />
      ))}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  grid: css({
    display: 'grid',
    gap: theme.spacing(1),
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  }),
});
