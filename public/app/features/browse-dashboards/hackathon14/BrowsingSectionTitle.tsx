import { css } from "@emotion/css";

import { GrafanaTheme2 } from "@grafana/data";
import { Icon, Stack, Text, useStyles2 } from "@grafana/ui"

export const BrowsingSectionTitle = ({ title, subtitle, icon }: { title: string, subtitle: string, icon: IconName }) => {
    const styles = useStyles2(getStyles);
    return (
        <Stack direction="row" gap={2} alignItems="center">
        <div>
          <div className={styles.headerTitle}>
            <Icon name={icon} size="lg" className={styles.headerIcon} style={{ marginRight: '4px' }} />
            <Text variant="h4">{title}</Text>
          </div>
          <Text variant="bodySmall" color="secondary">
            {subtitle}
          </Text>
        </div>
      </Stack>
    )
}

const getStyles = (theme: GrafanaTheme2) => ({
    headerIcon: css({
      color: '#8b5cf6',
      filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.4))',
    }),
  
    headerTitle: css({
      background: 'linear-gradient(135deg, #8b5cf6, #d946ef)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    }),

  });
  
