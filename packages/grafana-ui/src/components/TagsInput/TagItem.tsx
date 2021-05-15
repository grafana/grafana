import React, { FC } from 'react';
import { css } from 'emotion';
import { getTagColorsFromName } from '../../utils';
import { stylesFactory, useTheme } from '../../themes';
import { Icon } from '../Icon/Icon';
import { GrafanaTheme } from '@grafana/data';

interface Props {
  name: string;

  onRemove: (tag: string) => void;
}

const getStyles = stylesFactory(({ theme, name }: { theme: GrafanaTheme; name: string }) => {
  const { color, borderColor } = getTagColorsFromName(name);
  const height = theme.spacing.formInputHeight - 8;

  return {
    itemStyle: css`
      display: flex;
      align-items: center;
      height: ${height}px;
      line-height: ${height - 2}px;
      background-color: ${color};
      color: ${theme.palette.white};
      border: 1px solid ${borderColor};
      border-radius: 3px;
      padding: 0 ${theme.spacing.xs};
      margin-right: 3px;
      white-space: nowrap;
      text-shadow: none;
      font-weight: 500;
      font-size: ${theme.typography.size.sm};
    `,

    nameStyle: css`
      margin-right: 3px;
    `,
  };
});

/**
 * @internal
 * Only used internally by TagsInput
 * */
export const TagItem: FC<Props> = ({ name, onRemove }) => {
  const theme = useTheme();
  const styles = getStyles({ theme, name });

  return (
    <div className={styles.itemStyle}>
      <span className={styles.nameStyle}>{name}</span>
      <Icon className="pointer" name="times" onClick={() => onRemove(name)} />
    </div>
  );
};
