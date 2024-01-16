import { css } from '@emotion/css';
import React, { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme2) => ({
  metaContainer: css`
    flex: 1;
    color: ${theme.colors.text.secondary};
    margin-bottom: ${theme.spacing(2)};
    min-width: 30%;
    display: flex;
    flex-wrap: wrap;
  `,
  metaItem: css`
    margin-right: ${theme.spacing(2)};
    margin-top: ${theme.spacing(0.5)};
    display: flex;
    align-items: center;

    .logs-meta-item__error {
      color: ${theme.colors.error.text};
    }
  `,
  metaLabel: css`
    margin-right: calc(${theme.spacing(2)} / 2);
    font-size: ${theme.typography.bodySmall.fontSize};
    font-weight: ${theme.typography.fontWeightMedium};
  `,
  metaValue: css`
    font-family: ${theme.typography.fontFamilyMonospace};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});

export interface MetaItemProps {
  label?: string;
  value: string | JSX.Element;
}

const MetaInfoItem = memo(function MetaInfoItem(props: MetaItemProps) {
  const style = useStyles2(getStyles);
  const { label, value } = props;

  return (
    <div data-testid="meta-info-text-item" className={style.metaItem}>
      {label && <span className={style.metaLabel}>{label}:</span>}
      <span className={style.metaValue}>{value}</span>
    </div>
  );
});

interface MetaInfoTextProps {
  metaItems: MetaItemProps[];
}

export const MetaInfoText = memo(function MetaInfoText(props: MetaInfoTextProps) {
  const style = useStyles2(getStyles);
  const { metaItems } = props;

  return (
    <div className={style.metaContainer} data-testid="meta-info-text">
      {metaItems.map((item, index) => (
        <MetaInfoItem key={`${index}-${item.label}`} label={item.label} value={item.value} />
      ))}
    </div>
  );
});
