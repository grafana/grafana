import React, { FC } from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useTheme, styleMixins } from '../../themes';
import { Tooltip, PopoverContent } from '../Tooltip/Tooltip';
import { OnTagClick } from '../Tags/Tag';
import { TagList } from '..';

export interface Props {
  title?: string;
  description?: string;
  /** Content for the card's tooltip */
  tooltip?: PopoverContent;
  /** List of tags to display in the card */
  tags?: string[];
  /** Optional callback for tag onclick event */
  onTagClick?: OnTagClick;
  /** Indicates if the card and all its actions can be interacted with */
  disabled?: boolean;
}

export const Card: FC<Props> = ({ title, description, tags = [], onTagClick, disabled, tooltip = '' }) => {
  const theme = useTheme();
  const styles = getStyles(theme, disabled);
  return (
    <>
      <Tooltip placement="top" content={tooltip} theme="info" show={!!tooltip}>
        <div tabIndex={0} className={styles.container}>
          <p className={styles.title}>{title}</p>
          {description && <p className={styles.description}>{description}</p>}
          {!!tags.length && <TagList tags={tags} onClick={onTagClick} />}
          <div className={styles.overlay} />
        </div>
      </Tooltip>
    </>
  );
};

const getStyles = (theme: GrafanaTheme, disabled = false) => {
  return {
    container: css`
      width: 100%;
      color: ${theme.colors.textStrong};
      background: ${theme.colors.bg2};
      border-radius: ${theme.border.radius.sm};
      padding: ${theme.spacing.md};
      position: relative;
      pointer-events: ${disabled ? 'none' : 'auto'};

      &:hover {
        background: ${styleMixins.hoverColor(theme.colors.bg2, theme)};
        cursor: ${disabled ? 'not-allowed' : 'pointer'};
      }

      &:focus {
        ${styleMixins.focusCss(theme)};
      }
    `,
    title: css`
      margin-bottom: ${theme.spacing.xxs};
      font-size: ${theme.typography.size.md};
    `,
    description: css`
      margin-bottom: ${theme.spacing.sm};
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.textSemiWeak};
    `,

    overlay: css`
      position: absolute;
      top: 1px;
      left: 1px;
      right: 1px;
      bottom: 1px;
      background: linear-gradient(180deg, rgba(75, 79, 84, 0.5) 0%, rgba(82, 84, 92, 0.5) 100%);
      width: calc(100% - 2px);
      height: calc(100% - 2px);
      z-index: ${disabled ? 0 : -1};
      border-radius: ${theme.border.radius.sm};
    `,
  };
};
