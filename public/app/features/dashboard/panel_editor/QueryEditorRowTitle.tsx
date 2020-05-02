import React from 'react';
import { css } from 'emotion';
import { DataQuery, DataSourceApi, GrafanaTheme } from '@grafana/data';
import { HorizontalGroup, stylesFactory, useTheme } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

interface QueryEditorRowTitleProps {
  query: DataQuery;
  datasource: DataSourceApi;
  inMixedMode: boolean;
  disabled: boolean;
  onClick: (e: React.MouseEvent) => void;
  collapsedText: string;
}

export const QueryEditorRowTitle: React.FC<QueryEditorRowTitleProps> = ({
  datasource,
  inMixedMode,
  disabled,
  query,
  onClick,
  collapsedText,
}) => {
  const theme = useTheme();
  const styles = getQueryEditorRowTitleStyles(theme);
  return (
    <HorizontalGroup align="center">
      <div className={styles.refId} aria-label={selectors.components.QueryEditorRow.title(query.refId)}>
        <span>{query.refId}</span>
        {inMixedMode && <em className={styles.contextInfo}> ({datasource.name})</em>}
        {disabled && <em className={styles.contextInfo}> Disabled</em>}
      </div>
      {collapsedText && (
        <div className={styles.collapsedText} onClick={onClick}>
          {collapsedText}
        </div>
      )}
    </HorizontalGroup>
  );
};

const getQueryEditorRowTitleStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    refId: css`
      font-weight: ${theme.typography.weight.semibold};
      color: ${theme.colors.textBlue};
      cursor: pointer;
      display: flex;
      align-items: center;
    `,
    collapsedText: css`
      font-weight: ${theme.typography.weight.regular};
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.textWeak};
      padding: 0 10px;
      display: flex;
      align-items: center;
      flex-grow: 1;
      overflow: hidden;
      font-style: italic;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      min-width: 0;
    `,
    contextInfo: css`
      font-size: ${theme.typography.size.sm};
      font-style: italic;
      color: ${theme.colors.textWeak};
      padding-left: 10px;
    `,
  };
});
