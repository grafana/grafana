import React from 'react';
import { css, cx } from 'emotion';
import { DataQuery, DataSourceApi, GrafanaTheme } from '@grafana/data';
import { Icon, Input, stylesFactory, useTheme } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { useState } from 'react';

interface QueryEditorRowTitleProps {
  query: DataQuery;
  datasource: DataSourceApi;
  inMixedMode?: boolean;
  disabled?: boolean;
  onChange: (query: DataQuery) => void;
  onClick: (e: React.MouseEvent) => void;
  collapsedText: string | null;
}

export const QueryEditorRowTitle: React.FC<QueryEditorRowTitleProps> = ({
  datasource,
  inMixedMode,
  disabled,
  query,
  onClick,
  onChange,
  collapsedText,
}) => {
  const theme = useTheme();
  const styles = getQueryEditorRowTitleStyles(theme);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const onEditQuery = (event: React.SyntheticEvent) => {
    setIsEditing(true);
  };

  const onEndEditName = (newName: string) => {
    setIsEditing(false);

    if (query.refId !== newName) {
      onChange({
        ...query,
        refId: newName,
      });
    }
  };

  const onEditQueryBlur = (event: React.SyntheticEvent<HTMLInputElement>) => {
    onEndEditName(event.currentTarget.value);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      onEndEditName((event.target as any).value);
    }
  };

  return (
    <div className={styles.wrapper}>
      {!isEditing && (
        <div
          className={styles.queryNameWrapper}
          aria-label={selectors.components.QueryEditorRow.title(query.refId)}
          title="Edit query name"
          onClick={onEditQuery}
        >
          <span className={styles.queryName}>{query.refId}</span>
          <Icon name="pen" className={styles.queryEditIcon} size="sm" />
        </div>
      )}
      {isEditing && (
        <Input
          defaultValue={query.refId}
          onBlur={onEditQueryBlur}
          autoFocus
          onKeyDown={onKeyDown}
          className={styles.queryNameInput}
        />
      )}
      {inMixedMode && <em className={styles.contextInfo}> ({datasource.name})</em>}
      {disabled && <em className={styles.contextInfo}> Disabled</em>}

      {collapsedText && (
        <div className={styles.collapsedText} onClick={onClick}>
          {collapsedText}
        </div>
      )}
    </div>
  );
};

const getQueryEditorRowTitleStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      display: flex;
      align-items: center;
      flex-grow: 1;

      &:hover {
        .query-name-wrapper {
          display: flex;
          background: ${theme.colors.formInputBg};
          border: ${theme.colors.formInputBorder};
        }

        .query-name-edit-icon {
          visibility: visible;
        }
      }
    `,
    queryNameWrapper: cx(
      css`
        display: flex;
        cursor: pointer;
        border-radius: ${theme.border.radius.md};
        align-items: center;
        padding-right: ${theme.spacing.xs};
      `,
      'query-name-wrapper'
    ),
    queryName: css`
      font-weight: ${theme.typography.weight.semibold};
      color: ${theme.colors.textBlue};
      cursor: pointer;
      margin-left: ${theme.spacing.sm};
      overflow: hidden;
    `,
    queryEditIcon: cx(
      css`
        margin-left: ${theme.spacing.md};
        visibility: hidden;
      `,
      'query-name-edit-icon'
    ),
    queryNameInput: css`
      max-width: 300px;
    `,
    collapsedText: css`
      font-weight: ${theme.typography.weight.regular};
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.textWeak};
      padding-left: ${theme.spacing.sm};
      align-items: center;
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
