import { css } from '@emotion/css';

import { type CustomTransformOperator, type DataTransformerConfig, type GrafanaTheme2 } from '@grafana/data';
import { type SystemTransformationPosition } from '@grafana/scenes';
import { Icon, useStyles2 } from '@grafana/ui';

import { SystemTransformationBadge, SystemTransformationList } from '../systemTransformationDisplay';

interface SystemTransformationRowsProps {
  transformations: Array<DataTransformerConfig | CustomTransformOperator>;
  position: SystemTransformationPosition;
}

export function SystemTransformationRows({ transformations, position }: SystemTransformationRowsProps) {
  const styles = useStyles2(getStyles);

  return (
    <SystemTransformationList
      transformations={transformations}
      position={position}
      className={styles.systemRows}
      itemClassName={styles.systemRow}
      nameClassName={styles.systemRowName}
      leading={<Icon name="lock" size="sm" />}
      trailing={<SystemTransformationBadge />}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  systemRows: css({
    listStyle: 'none',
    margin: 0,
    padding: 0,
  }),
  systemRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1, 1, 2),
    marginBottom: theme.spacing(0.5),
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
  }),
  systemRowName: css({
    flexGrow: 1,
    fontWeight: theme.typography.fontWeightMedium,
  }),
});
