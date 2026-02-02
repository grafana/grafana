import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { getTagColorsFromName, Icon, useStyles2 } from '@grafana/ui';

export interface Props {
  label: string;
  removeIcon: boolean;
  count: number;
  onClick?: React.MouseEventHandler<SVGElement>;
  // BMC Code : Accessibility Change Next line
  customClearTags?: (label: string) => void;
}

// BMC Code : Accessibility Change added customClearTags Props in Next line
export const TagBadge = ({ count, label, onClick, removeIcon, customClearTags }: Props) => {
  const { color } = getTagColorsFromName(label);
  const styles = useStyles2(getStyles);

  const countLabel = count !== 0 && <span style={{ marginLeft: '3px' }}>{`(${count})`}</span>;

  return (
    <span
      className={styles.badge}
      style={{
        backgroundColor: color,
      }}
    >
      {removeIcon && (
        <Icon
          onClick={onClick}
          name="times"
          // BMC Code : Accessibility Change starts here.
          tabIndex={0}
          role="button"
          aria-label={`Remove tag ${label}`}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              customClearTags?.(label);
            }
          }}
          // BMC Code : Accessibility Change ends here.
        />
      )}
      {label} {countLabel}
    </span>
  );
};

export const getStyles = (theme: GrafanaTheme2) => ({
  badge: css({
    ...theme.typography.bodySmall,
    backgroundColor: theme.v1.palette.gray1,
    borderRadius: theme.shape.radius.default,
    color: theme.v1.palette.white,
    display: 'inline-block',
    height: '20px',
    lineHeight: '20px',
    padding: theme.spacing(0, 0.75),
    verticalAlign: 'baseline',
    whiteSpace: 'nowrap',
    '&:hover': {
      opacity: 0.85,
    },
  }),
});
