import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface ProfileTooltipContentProps {
  label: string;
  collapsedCount?: number;
  children: ReactNode;
}

export function ProfileTooltipContent({ label, collapsedCount, children }: ProfileTooltipContentProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.tooltipContent}>
      <p className={styles.tooltipName}>
        {label}
        {Boolean(collapsedCount) && (
          <span>
            <br />
            and {collapsedCount} similar items
          </span>
        )}
      </p>
      {children}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  tooltipContent: css({
    title: 'tooltipContent',
    fontSize: theme.typography.sm.fontSize,
    width: '100%',
  }),
  tooltipName: css({
    title: 'tooltipName',
    marginTop: 0,
    wordBreak: 'break-all',
  }),
});
