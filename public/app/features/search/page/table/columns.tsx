import React from 'react';
import { DataSourceRef, Field } from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { DefaultCell } from '@grafana/ui/src/components/Table/DefaultCell';
import { TableColumn } from './Table';
import SVG from 'react-inlinesvg';
import { TagList } from '@grafana/ui';

export function makeDataSourceColumn(field: Field<DataSourceRef[]>, width: number, iconClass: string): TableColumn {
  return {
    Cell: DefaultCell,
    id: `column-dsList`,
    field,
    Header: 'Data source',
    accessor: (row: any, i: number) => {
      const dslist = field.values.get(i);
      if (dslist?.length) {
        const srv = getDataSourceSrv();
        return (
          <div>
            {dslist.map((v, i) => {
              const settings = srv.getInstanceSettings(v);
              const icon = settings?.meta?.info?.logos?.small;
              if (icon) {
                return (
                  <span key={i}>
                    <SVG src={icon} width={14} height={14} title={settings.type} className={iconClass} />
                    {settings.name}
                  </span>
                );
              }
              return <span key={i}>{v.type}</span>;
            })}
          </div>
        );
      }
      return null;
    },
    width,
  };
}

export function makeTypeColumn(
  kindField: Field<string>,
  typeField: Field<string>,
  width: number,
  typeTextClass: string,
  iconClass: string
): TableColumn {
  return {
    Cell: DefaultCell,
    id: `column-type`,
    field: kindField,
    Header: 'Type',
    accessor: (row: any, i: number) => {
      const kind = kindField.values.get(i);
      let icon = 'public/img/icons/unicons/apps.svg';
      let txt = 'Dashboard';
      if (kind) {
        txt = kind;
        switch (txt) {
          case 'dashboard':
            txt = 'Dashboard';
            break;

          case 'folder':
            icon = 'public/img/icons/unicons/folder.svg';
            txt = 'Folder';
            break;

          case 'panel':
            icon = 'public/img/icons/unicons/graph-bar.svg';
            const type = typeField.values.get(i);
            if (type) {
              txt = type;
              const info = config.panels[txt];
              if (info?.name) {
                const v = info.info?.logos.small;
                if (v && v.endsWith('.svg')) {
                  icon = v;
                }
                txt = info.name;
              }
            }
            break;
        }
      }

      return (
        <div className={typeTextClass}>
          <SVG src={icon} width={14} height={14} title={txt} className={iconClass} />
          {txt}
        </div>
      );
    },
    width,
  };
}

export function makeTagsColumn(field: Field<string[]>, width: number): TableColumn {
  return {
    Cell: DefaultCell,
    id: `column-tags`,
    field: field,
    Header: 'Tags',
    accessor: (row: any, i: number) => {
      const tags = field.values.get(i);
      if (tags) {
        return <TagList tags={tags} onClick={(v) => console.log('CLICKED TAG', v)} />;
      }
      return null;
    },
    width,
  };
}
