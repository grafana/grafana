import { useEffect } from 'react';

import { CoreApp } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

import { useQueryLibraryContext } from './QueryLibraryContext';

export function SavedQueriesToggletipWrapper({
  children,
  datasourceUid,
  app,
  onSelectQuery,
}: {
  children: JSX.Element;
  datasourceUid: string;
  app: CoreApp;
  onSelectQuery?: (query: DataQuery) => void;
}) {
  const { renderSavedQueryToggletip, setShouldOpenToggletip } = useQueryLibraryContext();

  useEffect(() => {
    setShouldOpenToggletip(true);
  }, [setShouldOpenToggletip]);

  return renderSavedQueryToggletip(datasourceUid, children, app, onSelectQuery || (() => {}));
}
