import { css, cx } from '@emotion/css';
import * as React from 'react';
import { ReactNode, useState } from 'react';

import { DataQuery, DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { FieldValidationMessage, Icon, Input, useStyles2 } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

export interface Props<TQuery extends DataQuery = DataQuery> {
  query: TQuery;
  queries: TQuery[];
  hidden?: boolean;
  dataSource: DataSourceInstanceSettings;
  renderExtras?: () => ReactNode;
  onChangeDataSource?: (settings: DataSourceInstanceSettings) => void;
  onChange: (query: TQuery) => void;
  onClick: (e: React.MouseEvent) => void;
  collapsedText: string | null;
  alerting?: boolean;
  hideRefId?: boolean;
}

export const QueryEditorRowHeader = <TQuery extends DataQuery>(props: Props<TQuery>) => {
  const { query, queries, onChange, collapsedText, renderExtras, hidden, hideRefId = false } = props;

  const styles = useStyles2(getStyles);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const onEditQuery = (event: React.SyntheticEvent) => {
    setIsEditing(true);
  };

  const onEndEditName = (newName: string) => {
    setIsEditing(false);

    // Ignore change if invalid
    if (validationError) {
      setValidationError(null);
      return;
    }

    if (query.refId !== newName) {
      onChange({
        ...query,
        refId: newName,
      });
    }
  };

  const onInputChange = (event: React.SyntheticEvent<HTMLInputElement>) => {
    const newName = event.currentTarget.value.trim();

    if (newName.length === 0) {
      setValidationError('An empty query name is not allowed');
      return;
    }

    for (const otherQuery of queries) {
      if (otherQuery !== query && newName === otherQuery.refId) {
        setValidationError('Query name already exists');
        return;
      }
    }

    if (validationError) {
      setValidationError(null);
    }
  };

  const onEditQueryBlur = (event: React.SyntheticEvent<HTMLInputElement>) => {
    onEndEditName(event.currentTarget.value.trim());
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      onEndEditName(event.currentTarget.value);
    }
  };

  const onFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    event.target.select();
  };

  return (
    <>
      <div className={styles.wrapper}>
        {!hideRefId && !isEditing && (
          <button
            className={styles.queryNameWrapper}
            aria-label={selectors.components.QueryEditorRow.title(query.refId)}
            title="Edit query name"
            onClick={onEditQuery}
            data-testid="query-name-div"
            type="button"
          >
            <span className={styles.queryName}>{query.refId}</span>
            <Icon name="pen" className={styles.queryEditIcon} size="sm" />
          </button>
        )}

        {!hideRefId && isEditing && (
          <>
            <Input
              type="text"
              defaultValue={query.refId}
              onBlur={onEditQueryBlur}
              autoFocus
              onKeyDown={onKeyDown}
              onFocus={onFocus}
              invalid={validationError !== null}
              onChange={onInputChange}
              className={styles.queryNameInput}
              data-testid="query-name-input"
            />
            {validationError && <FieldValidationMessage horizontal>{validationError}</FieldValidationMessage>}
          </>
        )}
        {renderDataSource(props, styles)}
        {renderExtras && <div className={styles.itemWrapper}>{renderExtras()}</div>}
        {hidden && <em className={styles.contextInfo}>Hidden</em>}
      </div>

      {collapsedText && <div className={styles.collapsedText}>{collapsedText}</div>}
    </>
  );
};

const renderDataSource = <TQuery extends DataQuery>(
  props: Props<TQuery>,
  styles: ReturnType<typeof getStyles>
): ReactNode => {
  const { alerting, dataSource, onChangeDataSource } = props;

  if (!onChangeDataSource) {
    return <em className={styles.contextInfo}>({dataSource.name})</em>;
  }

  return (
    <div className={styles.itemWrapper}>
      <DataSourcePicker
        dashboard={true}
        variables={true}
        alerting={alerting}
        current={dataSource.name}
        onChange={onChangeDataSource}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      label: 'Wrapper',
      display: 'flex',
      alignItems: 'center',
      marginLeft: theme.spacing(0.5),
      overflow: 'hidden',
    }),
    queryNameWrapper: css({
      display: 'flex',
      cursor: 'pointer',
      border: '1px solid transparent',
      borderRadius: theme.shape.radius.default,
      alignItems: 'center',
      padding: theme.spacing(0, 0, 0, 0.5),
      margin: 0,
      background: 'transparent',
      overflow: 'hidden',

      '&:hover': {
        background: theme.colors.action.hover,
        border: `1px dashed ${theme.colors.border.strong}`,
      },

      '&:focus': {
        border: `2px solid ${theme.colors.primary.border}`,
      },

      '&:hover, &:focus': {
        '.query-name-edit-icon': {
          visibility: 'visible',
        },
      },
    }),
    queryName: css({
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.primary.text,
      cursor: 'pointer',
      overflow: 'hidden',
      marginLeft: theme.spacing(0.5),
    }),
    queryEditIcon: cx(
      css({
        marginLeft: theme.spacing(2),
        visibility: 'hidden',
      }),
      'query-name-edit-icon'
    ),
    queryNameInput: css({
      maxWidth: '300px',
      margin: '-4px 0',
    }),
    collapsedText: css({
      fontWeight: theme.typography.fontWeightRegular,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      paddingLeft: theme.spacing(1),
      alignItems: 'center',
      overflow: 'hidden',
      fontStyle: 'italic',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
    }),
    contextInfo: css({
      fontSize: theme.typography.bodySmall.fontSize,
      fontStyle: 'italic',
      color: theme.colors.text.secondary,
      paddingLeft: '10px',
      paddingRight: '10px',
    }),
    itemWrapper: css({
      display: 'flex',
      marginLeft: '4px',
    }),
  };
};
