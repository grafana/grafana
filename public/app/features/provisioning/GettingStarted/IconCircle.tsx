import { css } from '@emotion/css';

import { GrafanaTheme2, colorManipulator } from '@grafana/data';
import { Icon, IconName, useStyles2 } from '@grafana/ui';

export interface IconCircleProps {
  icon: IconName;
  color: 'blue' | 'orange' | 'purple';
}

export const IconCircle = ({ icon, color }: IconCircleProps) => {
  const styles = useStyles2(getStyles, color);

  return (
    <div className={styles.iconCircle}>
      <Icon name={icon} size="xl" />
    </div>
  );
};

function getStyles(theme: GrafanaTheme2, color: IconCircleProps['color']) {
  const resolvedColor = theme.visualization.getColorByName(color);

  return {
    iconCircle: css({
      borderRadius: theme.shape.radius.circle,
      padding: theme.spacing(1),
      color: resolvedColor,
      backgroundColor: colorManipulator.alpha(resolvedColor, 0.2),
    }),
  };
}
