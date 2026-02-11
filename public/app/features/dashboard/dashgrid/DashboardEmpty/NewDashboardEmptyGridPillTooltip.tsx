import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack, useStyles2 } from '@grafana/ui';

interface Props {
  img: React.ReactNode;
  description: string;
}

export const NewDashboardEmptyGridPillTooltip = ({ img, description }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={0}>
      {img}
      <div className={styles.description}>{description}</div>
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  description: css({
    backgroundColor: theme.colors.background.secondary,
    color: theme.colors.text.secondary,
    padding: theme.spacing(1),
  }),
});
