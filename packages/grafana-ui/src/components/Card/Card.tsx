import React, { FC, ReactNode } from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useTheme, styleMixins } from '../../themes';
import { Tooltip, PopoverContent } from '../Tooltip/Tooltip';
import { OnTagClick } from '../Tags/Tag';
import { TagList } from '..';

export interface Props {
  title?: string;
  /** Card description text or meta data. If array is supplied, elements will be rendered with vertical line separator */
  metaData?: ReactNode | ReactNode[];
  /** Content for the card's tooltip */
  tooltip?: PopoverContent;
  /** List of tags to display in the card */
  tags?: string[];
  /** Optional callback for tag onclick event */
  onTagClick?: OnTagClick;
  /** Indicates if the card and all its actions can be interacted with */
  disabled?: boolean;
  /** Image or icon to be displayed on the let side of the card */
  mediaContent?: ReactNode;
  /** Main card actions **/
  actions?: ReactNode[];
  /** Right-side actions */
  secondaryActions?: ReactNode[];
}

export const Card: FC<Props> = ({
  title,
  metaData,
  tags = [],
  onTagClick,
  disabled,
  mediaContent,
  actions = [],
  tooltip = '',
  secondaryActions = [],
}) => {
  const hasActions = Boolean(actions.length || secondaryActions.length);
  const disableHover = actions.length > 1;
  const theme = useTheme();
  const styles = getStyles(theme, disabled && !actions.length, disableHover);
  // Join meta data elements by '|'
  const meta = Array.isArray(metaData)
    ? (metaData as ReactNode[]).reduce((prev, curr) => [prev, <span className={styles.separator}>|</span>, curr])
    : metaData;
  return (
    <>
      <Tooltip placement="top" content={tooltip} theme="info" show={!!tooltip}>
        <div tabIndex={0} className={styles.container}>
          {mediaContent && <div className={styles.media}>{mediaContent}</div>}
          <div className={styles.inner}>
            <p className={styles.title}>{title}</p>
            {meta && <p className={styles.metaData}>{meta}</p>}
            {!!tags.length && <TagList tags={tags} onClick={onTagClick} />}
            {hasActions && (
              <div className={styles.actionRow}>
                {!!actions.length && <div className={styles.actions}>{actions}</div>}
                {!!secondaryActions.length && <div className={styles.secondaryActions}>{secondaryActions}</div>}
              </div>
            )}
          </div>
          <div className={styles.overlay} />
        </div>
      </Tooltip>
    </>
  );
};

const getStyles = (theme: GrafanaTheme, disabled = false, disableHover = false) => {
  return {
    container: css`
      display: flex;
      width: 100%;
      color: ${theme.colors.textStrong};
      background: ${theme.colors.bg2};
      border-radius: ${theme.border.radius.sm};
      padding: ${theme.spacing.md};
      position: relative;
      pointer-events: ${disabled ? 'none' : 'auto'};

      &:hover {
        background: ${disableHover ? theme.colors.bg2 : styleMixins.hoverColor(theme.colors.bg2, theme)};
        cursor: ${disableHover ? 'default' : 'pointer'};
      }

      &:focus {
        ${styleMixins.focusCss(theme)};
      }
    `,
    inner: css`
      width: 100%;
    `,
    title: css`
      margin-bottom: ${theme.spacing.xxs};
      font-size: ${theme.typography.size.md};
    `,
    metaData: css`
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
    media: css`
      margin-right: ${theme.spacing.md};
      max-width: 40px;
      & > * {
        width: 100%;
      }
    `,
    actionRow: css`
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    `,
    actions: css`
      & > * {
        margin-right: ${theme.spacing.sm};
      }
    `,
    secondaryActions: css`
      display: flex;
      align-items: center;
      & > * {
        margin-right: ${theme.spacing.sm};
      }
    `,
    separator: css`
      margin: 0 ${theme.spacing.sm};
    `,
  };
};
