import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { getTagColorsFromName } from '../../utils';
import { IconButton } from '../IconButton/IconButton';

interface Props {
  name: string;
  disabled?: boolean;
  onRemove: (tag: string) => void;
}

const getStyles = (theme: GrafanaTheme2) => {
  const height = theme.spacing.gridSize * 3;

  return {
    itemStyle: css`
      display: flex;
      gap: 3px;
      align-items: center;
      height: ${height}px;
      line-height: ${height - 2}px;
      color: #fff;
      border-width: 1px;
      border-style: solid;
      border-radius: 3px;
      padding: 0 ${theme.spacing(0.5)};
      white-space: nowrap;
      text-shadow: none;
      font-weight: 500;
      font-size: ${theme.typography.size.sm};
    `,

    nameStyle: css`
      max-width: 25ch;
      text-overflow: ellipsis;
      overflow: hidden;
    `,

    buttonStyles: css`
      margin: 0;
      &:hover::before {
        display: none;
      }
    `,
  };
};

/**
 * @internal
 * Only used internally by TagsInput
 * */
export const TagItem = ({ name, disabled, onRemove }: Props) => {
  const { color, borderColor } = getTagColorsFromName(name);
  const styles = useStyles2(getStyles);

  return (
    <li className={styles.itemStyle} style={{ backgroundColor: color, borderColor }}>
      <span className={styles.nameStyle}>{name}</span>
      <IconButton
        name="times"
        size="lg"
        disabled={disabled}
        ariaLabel={`Remove ${name}`}
        onClick={() => onRemove(name)}
        type="button"
        className={styles.buttonStyles}
      />
    </li>
  );
};
