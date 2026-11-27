import { Draft07 } from 'json-schema-library';
import { useMemo, useState } from 'react';

import { type ComponentDescriptor, type DataSourceRef, type DiscoverableComponentProps } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useDataSourceInstanceSettings } from '@grafana/runtime';

import { PreviewInputForm } from './PreviewInputForm';
import { useComponentDescriptor } from './useComponentDescriptors';
import { useCatalogComponent } from './usePluginComponent';

export interface PreviewInputs {
  datasource?: DataSourceRef | string;
  timeRange?: DiscoverableComponentProps['timeRange'];
  extraProps?: Record<string, unknown>;
}

interface CatalogPreviewProps extends PreviewInputs, Pick<DiscoverableComponentProps, 'filters' | 'onEvent'> {
  componentId: string;
}

function Loading() {
  return (
    <span role="status">
      <Trans i18nKey="plugins.catalog-preview.loading">Loading preview…</Trans>
    </span>
  );
}

function Unavailable() {
  return (
    <span>
      <Trans i18nKey="plugins.catalog-preview.unavailable">Component unavailable.</Trans>
    </span>
  );
}

export function CatalogPreview(selection: CatalogPreviewProps) {
  const { entry, loading, error } = useComponentDescriptor(selection.componentId);
  if (loading) {
    return <Loading />;
  }
  if (error || !entry) {
    return <Unavailable />;
  }
  return <PreviewSelection key={entry.id} entry={entry} selection={selection} />;
}

function PreviewSelection({ entry, selection }: { entry: ComponentDescriptor; selection: CatalogPreviewProps }) {
  const [draft, setDraft] = useState<PreviewInputs>({});
  const ref = selection.datasource ?? draft.datasource;
  const uid = typeof ref === 'string' ? ref : ref?.uid;
  const timeRange = selection.timeRange ?? draft.timeRange;
  const extra = entry.props ? { ...draft.extraProps, ...selection.extraProps } : {};
  const schema = useMemo(() => entry.props && new Draft07(entry.props), [entry.props]);
  if (!uid || !timeRange || (schema && schema.validate(extra).length > 0)) {
    return <PreviewInputForm entry={entry} selection={selection} schema={schema} onApply={setDraft} />;
  }
  return (
    <CheckDatasource
      entry={entry}
      uid={uid}
      expectedType={typeof ref === 'object' ? ref.type : undefined}
      viewProps={{ ...extra, timeRange, filters: selection.filters, onEvent: selection.onEvent }}
    />
  );
}

function CheckDatasource({
  entry,
  uid,
  expectedType,
  viewProps,
}: {
  entry: ComponentDescriptor;
  uid: string;
  expectedType?: string | null;
  viewProps: Omit<DiscoverableComponentProps, 'datasource'>;
}) {
  const { settings, isLoading, error } = useDataSourceInstanceSettings(uid);
  if (isLoading) {
    return <Loading />;
  }
  if (
    error ||
    !settings ||
    settings.uid !== uid ||
    settings.type !== entry.datasource ||
    (expectedType != null && expectedType !== settings.type)
  ) {
    return (
      <span>
        <Trans i18nKey="plugins.catalog-preview.invalid-datasource">Datasource unavailable or incompatible.</Trans>
      </span>
    );
  }
  return <ResolvedPreview entry={entry} viewProps={{ ...viewProps, datasource: { uid, type: settings.type } }} />;
}

function ResolvedPreview({
  entry,
  viewProps,
}: {
  entry: ComponentDescriptor;
  viewProps: DiscoverableComponentProps;
}) {
  const { component: View, isLoading } = useCatalogComponent(entry);
  if (isLoading) {
    return <Loading />;
  }
  if (!View) {
    return <Unavailable />;
  }
  return <View {...viewProps} />;
}
