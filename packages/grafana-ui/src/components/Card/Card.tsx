import React, { FC } from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useTheme, styleMixins } from '../../themes';
import { Tooltip, PopoverContent } from '../Tooltip/Tooltip';

export interface Props {
  title?: string;
  description?: string;
  /** Content for the card's tooltip */
  tooltip?: PopoverContent;
}

export const Card: FC<Props> = ({ title, description, tooltip = '' }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  return (
    <>
      <Tooltip placement="top" content={tooltip} theme="info" show={!!tooltip}>
        <div tabIndex={0} className={styles.container}>
          <p className={styles.title}>{title}</p>
          {description && <p className={styles.description}>{description}</p>}
        </div>
      </Tooltip>
    </>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      color: ${theme.colors.textStrong};
      background: ${theme.colors.bg2};
      border-radius: ${theme.border.radius.sm};
      padding: ${theme.spacing.md};
      &:hover {
        background: ${styleMixins.hoverColor(theme.colors.bg2, theme)};
        cursor: pointer;
      }

      &:focus {
        ${styleMixins.focusCss(theme)};
      }
    `,
    title: css`
      margin-bottom: ${theme.spacing.xs};
      font-size: ${theme.typography.size.md};
    `,
    description: css`
      margin-bottom: ${theme.spacing.xs};
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.textSemiWeak};
    `,
  };
};
