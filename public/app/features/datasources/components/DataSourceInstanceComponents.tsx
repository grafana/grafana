import { css, cx } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom-v5-compat';
import { useMeasure } from 'react-use';

import {
  type ComponentDescriptor,
  type DiscoverableComponentProps,
  type GrafanaTheme2,
  getDefaultTimeRange,
} from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { useAppPluginMetas } from '@grafana/runtime/internal';
import {
  Alert,
  Box,
  Button,
  FilterInput,
  IconButton,
  Pagination,
  RadioButtonGroup,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';
import { CatalogPreview } from 'app/features/plugins/extensions/CatalogPreview';
import { useComponentDescriptors } from 'app/features/plugins/extensions/useComponentDescriptors';

import { DataSourceComponentCard, DataSourceComponentGrid } from './DataSourceComponentCard';

const PAGE_SIZE = 20;
const SPLIT_MIN_WIDTH = 900;
const PHONE_PREVIEW_WIDTH = 390;

type PreviewSize = 'small' | 'medium' | 'large';

interface Props extends Pick<DiscoverableComponentProps, 'datasource'> {
  pageId: string;
  componentId?: string | null;
}

export function DataSourceInstanceComponents({ datasource, pageId, componentId }: Props) {
  const { entries, loading, error, retry } = useComponentDescriptors(datasource.type);
  const { value: providers } = useAppPluginMetas();
  const styles = useStyles2(getStyles);
  const [, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [previewSize, setPreviewSize] = useState<PreviewSize>('medium');
  const [layoutRef, { width }] = useMeasure<HTMLDivElement>();
  const resultsRef = useRef<HTMLUListElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const selected = entries.find(({ id }) => id === componentId);
  const selectedId = selected?.id;
  const wide = width >= SPLIT_MIN_WIDTH;
  const split = Boolean(selected) && wide && previewSize !== 'large';
  const previewOnly = Boolean(selected) && !split;

  useEffect(() => {
    const previous = returnFocusRef.current;
    if (!selectedId && previous) {
      (previous.isConnected ? previous : filterRef.current)?.focus();
      returnFocusRef.current = null;
    }
  }, [selectedId]);

  if (loading) {
    return (
      <p role="status">
        <Trans i18nKey="datasources.components.loading">Loading components…</Trans>
      </p>
    );
  }

  if (error) {
    return (
      <Alert severity="error" title={t('datasources.components.load-error', 'Could not load components')}>
        <Button type="button" onClick={retry}>
          <Trans i18nKey="datasources.components.retry">Retry</Trans>
        </Button>
      </Alert>
    );
  }

  if (!entries.length) {
    return (
      <p>
        <Trans i18nKey="datasources.components.empty">No components are available for this data source type.</Trans>
      </p>
    );
  }

  function selectPreview(id: string | null) {
    setSearchParams((params) => {
      const updated = new URLSearchParams(params);
      // Keep the built-in tab if the plugin also owns a config page named components.
      updated.set('page', pageId);
      if (id) {
        updated.set('component', id);
        return updated;
      }
      updated.delete('component');
      return updated;
    });
  }

  function closePreview() {
    returnFocusRef.current ??= filterRef.current;
    selectPreview(null);
  }

  const providersById = new Map(providers?.map((provider) => [provider.id, provider]));
  const query = filter.trim().toLocaleLowerCase();
  const matches = entries
    .filter(({ title, description }) =>
      title.toLocaleLowerCase().includes(query) || description?.toLocaleLowerCase().includes(query)
    )
    .sort((a, b) => a.title.localeCompare(b.title));
  const numberOfPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const currentPage = Math.min(page, numberOfPages);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const cards = (
    <Stack direction="column" gap={2} width="100%">
      {componentId && !selected && (
        <Alert
          severity="warning"
          title={t(
            'datasources.instance-components.unavailable',
            'This component is not available for this data source.'
          )}
        />
      )}
      {matches.length === 0 && (
        <Text element="p" color="secondary" role="status">
          <Trans i18nKey="datasources.instance-components.no-matches">No components match your filter.</Trans>
        </Text>
      )}
      {matches.length > 0 && (
        <>
          <Text variant="bodySmall" color="secondary" role="status">
            {t('datasources.instance-components.result-count', '{{count}} components', {
              count: matches.length,
              defaultValue_one: '{{count}} component',
              defaultValue_other: '{{count}} components',
            })}
          </Text>
          <DataSourceComponentGrid
            ref={resultsRef}
            tabIndex={-1}
            aria-label={t('datasources.instance-components.results', 'Components')}
          >
            {matches.slice(offset, offset + PAGE_SIZE).map((entry) => (
              <DataSourceComponentCard key={entry.id} entry={entry} provider={providersById.get(entry.pluginId)} excerpt>
                <Button
                  icon="eye"
                  size="sm"
                  variant={entry.id === selectedId ? 'primary' : 'secondary'}
                  fill="outline"
                  aria-pressed={entry.id === selectedId}
                  aria-label={t('datasources.components.preview-component', 'Preview {{title}}', { title: entry.title })}
                  onClick={(event) => {
                    returnFocusRef.current = event.currentTarget;
                    selectPreview(entry.id === selectedId ? null : entry.id);
                  }}
                >
                  <Trans i18nKey="datasources.instance-components.preview">Preview</Trans>
                </Button>
              </DataSourceComponentCard>
            ))}
          </DataSourceComponentGrid>
          <Pagination
            currentPage={currentPage}
            numberOfPages={numberOfPages}
            onNavigate={(nextPage) => {
              setPage(nextPage);
              resultsRef.current?.focus({ preventScroll: true });
              resultsRef.current?.scrollIntoView({ block: 'start' });
            }}
            hideWhenSinglePage
            showSmallVersion
          />
        </>
      )}
    </Stack>
  );

  return (
    <Stack ref={layoutRef} direction="column" gap={2}>
      <div hidden={previewOnly}>
        <FilterInput
          ref={filterRef}
          variant="filter"
          escapeRegex={false}
          aria-label={t('datasources.instance-components.filter', 'Filter components')}
          placeholder={t('datasources.instance-components.filter-placeholder', 'Filter by name or description')}
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setPage(1);
          }}
        />
      </div>
      <div className={split ? cx(styles.split, previewSize === 'small' && styles.phoneSplit) : undefined}>
        <div hidden={previewOnly}>{cards}</div>
        {selected && (
          <div className={cx(styles.preview, split && styles.previewPane)}>
            <ComponentPreview
              entry={selected}
              datasource={datasource}
              size={wide ? previewSize : undefined}
              onSizeChange={setPreviewSize}
              onClose={closePreview}
            />
          </div>
        )}
      </div>
    </Stack>
  );
}

interface ComponentPreviewProps extends Pick<DiscoverableComponentProps, 'datasource'> {
  entry: ComponentDescriptor;
  size?: PreviewSize;
  onSizeChange: (size: PreviewSize) => void;
  onClose: () => void;
}

function ComponentPreview({ entry, datasource, size, onSizeChange, onClose }: ComponentPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [timeRange] = useState(getDefaultTimeRange);
  const [filters] = useState<DiscoverableComponentProps['filters']>([]);

  useEffect(() => {
    previewRef.current?.focus();
  }, [entry.id]);

  return (
    <Box width="100%" padding={2} borderStyle="solid" borderColor="weak" borderRadius="default">
      <Stack
        ref={previewRef}
        role="region"
        aria-label={t('datasources.components.preview-component', 'Preview {{title}}', { title: entry.title })}
        tabIndex={-1}
        direction="column"
        gap={2}
      >
        {size !== undefined ? (
          <Stack justifyContent="flex-end" alignItems="center">
            <RadioButtonGroup<PreviewSize>
              size="sm"
              aria-label={t('datasources.instance-components.preview-width', 'Preview width')}
              value={size}
              options={[
                {
                  label: 'S',
                  value: 'small',
                  ariaLabel: t('datasources.instance-components.phone-width', 'Phone width'),
                },
                { label: 'M', value: 'medium', ariaLabel: t('datasources.instance-components.medium', 'Medium') },
                {
                  label: 'L',
                  value: 'large',
                  ariaLabel: t('datasources.instance-components.full-width', 'Full width'),
                },
              ]}
              onChange={onSizeChange}
            />
            <IconButton
              name="times"
              tooltip={t('datasources.instance-components.close', 'Close preview')}
              onClick={onClose}
            />
          </Stack>
        ) : (
          <div>
            <Button icon="arrow-left" variant="secondary" onClick={onClose}>
              <Trans i18nKey="datasources.instance-components.back">Back to components</Trans>
            </Button>
          </div>
        )}
        <CatalogPreview componentId={entry.id} datasource={datasource} timeRange={timeRange} filters={filters} />
      </Stack>
    </Box>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  split: css({
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr)',
    gap: theme.spacing(2),
    alignItems: 'start',
  }),
  phoneSplit: css({ gridTemplateColumns: `minmax(0, 1fr) ${PHONE_PREVIEW_WIDTH}px` }),
  preview: css({ minWidth: 0, overflowWrap: 'anywhere' }),
  previewPane: css({
    position: 'sticky',
    top: theme.spacing(1),
    maxHeight: '75vh',
    overflow: 'auto',
  }),
});
