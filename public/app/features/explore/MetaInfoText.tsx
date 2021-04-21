import React, { memo } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme) => ({
  metaContainer: css`
    flex: 1;
    color: ${theme.colors.textWeak};
    margin-bottom: ${theme.spacing.d};
    min-width: 30%;
    display: flex;
    flex-wrap: wrap;
  `,
  metaItem: css`
    margin-right: ${theme.spacing.d};
    margin-top: ${theme.spacing.xs};
    display: flex;
    align-items: baseline;

    .logs-meta-item__error {
      color: ${theme.palette.red};
    }
  `,
  metaLabel: css`
    margin-right: calc(${theme.spacing.d} / 2);
    font-size: ${theme.typography.size.sm};
    font-weight: ${theme.typography.weight.semibold};
  `,
  metaValue: css`
    font-family: ${theme.typography.fontFamily.monospace};
    font-size: ${theme.typography.size.sm};
  `,
});

export interface MetaItemProps {
  label?: string;
  value: string | JSX.Element;
}

export const MetaInfoItem = memo(function MetaInfoItem(props: MetaItemProps) {
  const style = useStyles(getStyles);
  const { label, value } = props;

  return (
    <div className={style.metaItem}>
      {label && <span className={style.metaLabel}>{label}:</span>}
      <span className={style.metaValue}>{value}</span>
    </div>
  );
});

export interface MetaInfoTextProps {
  metaItems: MetaItemProps[];
}

export const MetaInfoText = memo(function MetaInfoText(props: MetaInfoTextProps) {
  const style = useStyles(getStyles);
  const { metaItems } = props;

  return (
    <div className={style.metaContainer}>
      {metaItems.map((item, index) => (
        <MetaInfoItem key={`${index}-${item.label}`} label={item.label} value={item.value} />
      ))}
    </div>
  );
});

export default MetaInfoText;
