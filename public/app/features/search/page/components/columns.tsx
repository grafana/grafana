import { cx } from '@emotion/css';
import { intervalToDuration } from 'date-fns';
import Skeleton from 'react-loading-skeleton';

import {
  DisplayProcessor,
  Field,
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  getFieldDisplayName,
} from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { Checkbox, Icon, IconName, TagList, Text, Tooltip } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { t } from 'app/core/internationalization';
import { formatDate, formatDuration } from 'app/core/internationalization/dates';
import { PluginIconName } from 'app/features/plugins/admin/types';
import { ShowModalReactEvent } from 'app/types/events';

import { QueryResponse, SearchResultMeta } from '../../service/types';
import { getIconForKind } from '../../service/utils';
import { SelectionChecker, SelectionToggle } from '../selection';

import { ExplainScorePopup } from './ExplainScorePopup';
import { TableColumn } from './SearchResultsTable';

const TYPE_COLUMN_WIDTH = 175;
const DURATION_COLUMN_WIDTH = 200;
const DATASOURCE_COLUMN_WIDTH = 200;

export const generateColumns = (
  response: QueryResponse,
  availableWidth: number,
  selection: SelectionChecker | undefined,
  selectionToggle: SelectionToggle | undefined,
  clearSelection: () => void,
  styles: { [key: string]: string },
  onTagSelected: (tag: string) => void,
  onDatasourceChange?: (datasource?: string) => void,
  showingEverything?: boolean
): TableColumn[] => {
  const columns: TableColumn[] = [];
  const access = response.view.fields;
  const uidField = access.uid;
  const kindField = access.kind;
  let sortFieldWith = 0;
  const sortField: Field = access[response.view.dataFrame.meta?.custom?.sortBy];
  if (sortField) {
    sortFieldWith = 175;
    if (sortField.type === FieldType.time) {
      sortFieldWith += 25;
    }
    availableWidth -= sortFieldWith; // pre-allocate the space for the last column
  }

  if (access.explain && access.score) {
    availableWidth -= 100; // pre-allocate the space for the last column
  }

  let width = 50;
  if (selection && selectionToggle) {
    width = 0;
    columns.push({
      id: `column-checkbox`,
      width,
      Header: () => {
        const { view } = response;
        const hasSelection = selection('*', '*');
        const allSelected = view.every((item) => selection(item.kind, item.uid));
        return (
          <Checkbox
            indeterminate={!allSelected && hasSelection}
            checked={allSelected}
            disabled={!response}
            onChange={(e) => {
              if (hasSelection) {
                clearSelection();
              } else {
                for (let i = 0; i < view.length; i++) {
                  const item = view.get(i);
                  selectionToggle(item.kind, item.uid);
                }
              }
            }}
          />
        );
      },
      Cell: (p) => {
        const uid = uidField.values[p.row.index];
        const kind = kindField ? kindField.values[p.row.index] : 'dashboard'; // HACK for now
        const selected = selection(kind, uid);
        const hasUID = uid != null; // Panels don't have UID! Likely should not be shown on pages with manage options
        const { key, ...cellProps } = p.cellProps;
        return (
          <div key={key} {...cellProps} className={styles.cell}>
            <Checkbox
              disabled={!hasUID}
              value={selected && hasUID}
              onChange={(e) => {
                selectionToggle(kind, uid);
              }}
            />
          </div>
        );
      },
      field: uidField,
    });
    availableWidth -= width;
  }

  // Name column
  width = Math.max(availableWidth * 0.2, 300);
  columns.push({
    Cell: (p) => {
      let classNames = cx(styles.nameCellStyle);
      let name = access.name.values[p.row.index];
      const isDeleted = access.isDeleted?.values[p.row.index];

      if (!name?.length) {
        const loading = p.row.index >= response.view.dataFrame.length;
        name = loading ? 'Loading...' : 'Missing title'; // normal for panels
        classNames += ' ' + styles.missingTitleText;
      }
      const { key, ...cellProps } = p.cellProps;

      return (
        <div key={key} className={styles.cell} {...cellProps}>
          {!response.isItemLoaded(p.row.index) ? (
            <Skeleton width={200} />
          ) : isDeleted ? (
            <span className={classNames}>{name}</span>
          ) : (
            <a href={p.userProps.href} onClick={p.userProps.onClick} className={classNames} title={name}>
              {name}
            </a>
          )}
        </div>
      );
    },
    id: `column-name`,
    field: access.name!,
    Header: () => <div>{t('search.results-table.name-header', 'Name')}</div>,
    width,
  });
  availableWidth -= width;

  const showDeletedRemaining =
    response.view.fields.permanentlyDeleteDate && hasValue(response.view.fields.permanentlyDeleteDate);

  if (showDeletedRemaining && access.permanentlyDeleteDate) {
    width = DURATION_COLUMN_WIDTH;
    columns.push(makeDeletedRemainingColumn(response, access.permanentlyDeleteDate, width, styles));
    availableWidth -= width;
  } else {
    width = TYPE_COLUMN_WIDTH;
    columns.push(makeTypeColumn(response, access.kind, access.panel_type, width, styles));
    availableWidth -= width;
  }

  // Show datasources if we have any
  if (access.ds_uid && onDatasourceChange) {
    width = Math.min(availableWidth / 2.5, DATASOURCE_COLUMN_WIDTH);
    columns.push(
      makeDataSourceColumn(
        access.ds_uid,
        width,
        styles.typeIcon,
        styles.datasourceItem,
        styles.invalidDatasourceItem,
        onDatasourceChange
      )
    );
    availableWidth -= width;
  }

  const showTags = !showingEverything || hasValue(response.view.fields.tags);
  const meta = response.view.dataFrame.meta?.custom as SearchResultMeta;
  if (meta?.locationInfo && availableWidth > 0) {
    width = showTags ? Math.max(availableWidth / 1.75, 300) : availableWidth;
    availableWidth -= width;
    columns.push({
      Cell: (p) => {
        const parts = (access.location?.values[p.row.index] ?? '').split('/');
        const { key, ...cellProps } = p.cellProps;
        return (
          <div key={key} {...cellProps} className={styles.cell}>
            {!response.isItemLoaded(p.row.index) ? (
              <Skeleton width={150} />
            ) : (
              <div className={styles.locationContainer}>
                {parts.map((p) => {
                  let info = meta.locationInfo[p];
                  if (!info && p === 'general') {
                    info = { kind: 'folder', url: '/dashboards', name: 'Dashboards' };
                  }

                  if (info) {
                    const content = (
                      <>
                        <Icon name={getIconForKind(info.kind)} />

                        <Text variant="body" truncate>
                          {info.name}
                        </Text>
                      </>
                    );

                    if (info.url) {
                      return (
                        <a key={p} href={info.url} className={styles.locationItem}>
                          {content}
                        </a>
                      );
                    }

                    return (
                      <div key={p} className={styles.locationItem}>
                        {content}
                      </div>
                    );
                  }

                  return <span key={p}>{p}</span>;
                })}
              </div>
            )}
          </div>
        );
      },
      id: `column-location`,
      field: access.location ?? access.url,
      Header: t('search.results-table.location-header', 'Location'),
      width,
    });
  }

  if (availableWidth > 0 && showTags) {
    columns.push(makeTagsColumn(response, access.tags, availableWidth, styles, onTagSelected));
  }

  if (sortField && sortFieldWith) {
    const disp = sortField.display ?? getDisplayProcessor({ field: sortField, theme: config.theme2 });

    columns.push({
      Header: getFieldDisplayName(sortField),
      Cell: (p) => {
        const { key, ...cellProps } = p.cellProps;
        return (
          <div key={key} {...cellProps} className={styles.cell}>
            {getDisplayValue({
              sortField,
              getDisplay: disp,
              index: p.row.index,
              kind: access.kind,
            })}
          </div>
        );
      },
      id: `column-sort-field`,
      field: sortField,
      width: sortFieldWith,
    });
  }

  if (access.explain && access.score) {
    const vals = access.score.values;
    const showExplainPopup = (row: number) => {
      appEvents.publish(
        new ShowModalReactEvent({
          component: ExplainScorePopup,
          props: {
            name: access.name.values[row],
            explain: access.explain.values[row],
            frame: response.view.dataFrame,
            row: row,
          },
        })
      );
    };

    columns.push({
      Header: () => <div className={styles.sortedHeader}>Score</div>,
      Cell: (p) => {
        const { key, ...cellProps } = p.cellProps;
        return (
          // TODO: fix keyboard a11y
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <div
            key={key}
            {...cellProps}
            className={cx(styles.cell, styles.explainItem)}
            onClick={() => showExplainPopup(p.row.index)}
          >
            {vals[p.row.index]}
          </div>
        );
      },
      id: `column-score-field`,
      field: access.score,
      width: 100,
    });
  }

  return columns;
};

function hasValue(f: Field): boolean {
  for (let i = 0; i < f.values.length; i++) {
    if (f.values[i] != null) {
      return true;
    }
  }
  return false;
}

function makeDataSourceColumn(
  field: Field<string[]>,
  width: number,
  iconClass: string,
  datasourceItemClass: string,
  invalidDatasourceItemClass: string,
  onDatasourceChange: (datasource?: string) => void
): TableColumn {
  const srv = getDataSourceSrv();
  return {
    id: `column-datasource`,
    field,
    Header: t('search.results-table.datasource-header', 'Data source'),
    Cell: (p) => {
      const dslist = field.values[p.row.index];
      if (!dslist?.length) {
        return null;
      }
      const { key, ...cellProps } = p.cellProps;
      return (
        <div key={key} {...cellProps} className={cx(datasourceItemClass)}>
          {dslist.map((v, i) => {
            const settings = srv.getInstanceSettings(v);
            const icon = settings?.meta?.info?.logos?.small;
            if (icon) {
              return (
                // TODO: fix keyboard a11y
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                <span
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onDatasourceChange(settings.uid);
                  }}
                >
                  <img src={icon} alt="" width={14} height={14} title={settings.type} className={iconClass} />
                  {settings.name}
                </span>
              );
            }
            return (
              <span className={invalidDatasourceItemClass} key={i}>
                {v}
              </span>
            );
          })}
        </div>
      );
    },
    width,
  };
}

function makeDeletedRemainingColumn(
  response: QueryResponse,
  deletedField: Field<Date | undefined>,
  width: number,
  styles: Record<string, string>
): TableColumn {
  return {
    id: 'column-delete-age',
    field: deletedField,
    width,
    Header: t('search.results-table.deleted-remaining-header', 'Time remaining'),
    Cell: (p) => {
      const i = p.row.index;
      const deletedDate = deletedField.values[i];
      const { key, ...cellProps } = p.cellProps;

      if (!deletedDate || !response.isItemLoaded(p.row.index)) {
        return (
          <div key={key} {...cellProps} className={cx(styles.cell, styles.typeCell)}>
            <Skeleton width={100} />
          </div>
        );
      }

      const duration = calcCoarseDuration(new Date(), deletedDate);
      const isDeletingSoon = !Object.values(duration).some((v) => v > 0);
      const formatted = isDeletingSoon
        ? t('search.results-table.deleted-less-than-1-min', '< 1 min')
        : formatDuration(duration, { style: 'long' });

      return (
        <div key={key} {...cellProps} className={cx(styles.cell, styles.typeCell)}>
          <Tooltip content={formatDate(deletedDate, { dateStyle: 'medium', timeStyle: 'short' })}>
            <span>{formatted}</span>
          </Tooltip>
        </div>
      );
    },
  };
}

function makeTypeColumn(
  response: QueryResponse,
  kindField: Field<string>,
  typeField: Field<string>,
  width: number,
  styles: Record<string, string>
): TableColumn {
  return {
    id: `column-type`,
    field: kindField ?? typeField,
    Header: t('search.results-table.type-header', 'Type'),
    Cell: (p) => {
      const i = p.row.index;
      const kind = kindField?.values[i] ?? 'dashboard';
      let icon: IconName = 'apps';
      let txt = 'Dashboard';
      if (kind) {
        txt = kind;
        switch (txt) {
          case 'dashboard':
            txt = t('search.results-table.type-dashboard', 'Dashboard');
            break;

          case 'folder':
            icon = 'folder';
            txt = t('search.results-table.type-folder', 'Folder');
            break;

          case 'panel':
            icon = `${PluginIconName.panel}`;
            const type = typeField.values[i];
            if (type) {
              txt = type;
              const info = config.panels[txt];
              if (info?.name) {
                txt = info.name;
              } else {
                switch (type) {
                  case 'row':
                    txt = 'Row';
                    icon = `bars`;
                    break;
                  case 'singlestat': // auto-migration
                    txt = 'Singlestat';
                    break;
                  default:
                    icon = `question-circle`; // plugin not found
                }
              }
            }
            break;
        }
      }
      const { key, ...cellProps } = p.cellProps;
      return (
        <div key={key} {...cellProps} className={cx(styles.cell, styles.typeCell)}>
          {!response.isItemLoaded(p.row.index) ? (
            <Skeleton width={100} />
          ) : (
            <>
              <Icon name={icon} size="sm" title={txt} className={styles.typeIcon} />
              {txt}
            </>
          )}
        </div>
      );
    },
    width,
  };
}

function makeTagsColumn(
  response: QueryResponse,
  field: Field<string[]>,
  width: number,
  styles: Record<string, string>,
  onTagSelected: (tag: string) => void
): TableColumn {
  return {
    Cell: (p) => {
      const tags = field.values[p.row.index];
      const { key, ...cellProps } = p.cellProps;
      return (
        <div key={key} {...cellProps} className={styles.cell}>
          {!response.isItemLoaded(p.row.index) ? (
            <TagList.Skeleton />
          ) : (
            <>{tags ? <TagList className={styles.tagList} tags={tags} onClick={onTagSelected} /> : null}</>
          )}
        </div>
      );
    },
    id: `column-tags`,
    field: field,
    Header: t('search.results-table.tags-header', 'Tags'),
    width,
  };
}

function getDisplayValue({
  kind,
  sortField,
  index,
  getDisplay,
}: {
  kind: Field;
  sortField: Field;
  index: number;
  getDisplay: DisplayProcessor;
}) {
  const value = sortField.values[index];
  if (['folder', 'panel'].includes(kind.values[index]) && value === 0) {
    return '-';
  }
  return formattedValueToString(getDisplay(value));
}

/**
 * Calculates the rough duration between two dates, keeping only the most significant unit
 */
function calcCoarseDuration(start: Date, end: Date) {
  let { years = 0, months = 0, days = 0, hours = 0, minutes = 0 } = intervalToDuration({ start, end });

  if (years > 0) {
    return { years };
  } else if (months > 0) {
    return { months };
  } else if (days > 0) {
    return { days };
  } else if (hours > 0) {
    return { hours };
  }

  return { minutes };
}
