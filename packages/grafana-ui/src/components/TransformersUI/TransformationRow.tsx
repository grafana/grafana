import React, { useContext, useState } from 'react';
import { ThemeContext } from '../../themes/ThemeContext';
import { css } from 'emotion';
import { DataFrame } from '@grafana/data';
import { JSONFormatter } from '../JSONFormatter/JSONFormatter';
import { GrafanaTheme } from '@grafana/data';

interface TransformationRowProps {
  name: string;
  description: string;
  editor?: JSX.Element;
  onRemove: () => void;
  input: DataFrame[];
}

const getStyles = (theme: GrafanaTheme) => ({
  title: css`
    display: flex;
    padding: 4px 8px 4px 8px;
    position: relative;
    height: 35px;
    background: ${theme.colors.textFaint};
    border-radius: 4px 4px 0 0;
    flex-wrap: nowrap;
    justify-content: space-between;
    align-items: center;
  `,
  name: css`
    font-weight: ${theme.typography.weight.semibold};
    color: ${theme.colors.blue};
  `,
  iconRow: css`
    display: flex;
  `,
  icon: css`
    background: transparent;
    border: none;
    box-shadow: none;
    cursor: pointer;
    color: ${theme.colors.textWeak};
    margin-left: ${theme.spacing.sm};
    &:hover {
      color: ${theme.colors.text};
    }
  `,
  editor: css`
    border: 2px dashed ${theme.colors.textFaint};
    border-top: none;
    border-radius: 0 0 4px 4px;
    padding: 8px;
  `,
});

export const TransformationRow = ({ onRemove, editor, name, input }: TransformationRowProps) => {
  const theme = useContext(ThemeContext);
  const [viewDebug, setViewDebug] = useState(false);
  const styles = getStyles(theme);
  return (
    <div
      className={css`
        margin-bottom: 10px;
      `}
    >
      <div className={styles.title}>
        <div className={styles.name}>{name}</div>
        <div className={styles.iconRow}>
          <div onClick={() => setViewDebug(!viewDebug)} className={styles.icon}>
            <i className="fa fa-fw fa-bug" />
          </div>
          <div onClick={onRemove} className={styles.icon}>
            <i className="fa fa-fw fa-trash" />
          </div>
        </div>
      </div>
      <div className={styles.editor}>
        {editor}
        {viewDebug && (
          <div>
            <JSONFormatter json={input} />
          </div>
        )}
      </div>
    </div>
  );
};
