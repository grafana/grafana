import { css } from '@emotion/css';
import debounce from 'debounce-promise';
import { useCallback, useMemo, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { AsyncMultiSelect, Icon, Button, useStyles2 } from '@grafana/ui';
import { config } from 'app/core/config';
import { t, Trans } from 'app/core/internationalization';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { FolderInfo, PermissionLevelString } from 'app/types';

export interface FolderFilterProps {
  onChange: (folder: FolderInfo[]) => void;
  maxMenuHeight?: number;
}

export function FolderFilter({ onChange, maxMenuHeight }: FolderFilterProps): JSX.Element {
  const styles = useStyles2(getStyles);
  const [loading, setLoading] = useState(false);
  const getOptions = useCallback((searchString: string) => getFoldersAsOptions(searchString, setLoading), []);
  const debouncedLoadOptions = useMemo(() => debounce(getOptions, 300), [getOptions]);

  const [value, setValue] = useState<Array<SelectableValue<FolderInfo>>>([]);
  const onSelectOptionChange = useCallback(
    (folders: Array<SelectableValue<FolderInfo>>) => {
      const changedFolderIds = folders.filter((f) => Boolean(f.value)).map((f) => f.value!);
      onChange(changedFolderIds);
      setValue(folders);
    },
    [onChange]
  );

  return (
    <div className={styles.container}>
      {value.length > 0 && (
        <Button size="xs" icon="trash-alt" fill="text" className={styles.clear} onClick={() => onChange([])}>
          <Trans i18nKey="folder-filter.clear-folder-button">Clear folders</Trans>
        </Button>
      )}
      <AsyncMultiSelect
        value={value}
        onChange={onSelectOptionChange}
        isLoading={loading}
        loadOptions={debouncedLoadOptions}
        maxMenuHeight={maxMenuHeight}
        placeholder={t('folder-filter.select-placeholder', 'Filter by folder')}
        noOptionsMessage="No folders found"
        prefix={<Icon name="filter" />}
        aria-label={t('folder-filter.select-aria-label', 'Folder filter')}
        defaultOptions
      />
    </div>
  );
}

async function getFoldersAsOptions(
  searchString: string,
  setLoading: (loading: boolean) => void
): Promise<Array<SelectableValue<FolderInfo>>> {
  setLoading(true);

  // Use Unified Storage API behind toggle
  if (config.featureToggles.unifiedStorageSearchUI) {
    const searcher = getGrafanaSearcher();
    const queryResponse = await searcher.search({
      query: searchString,
      kind: ['folder'],
      limit: 100,
      permission: PermissionLevelString.View,
    });

    const options = queryResponse.view.map((item) => ({
      label: item.name,
      value: { uid: item.uid, title: item.name },
    }));

    if (!searchString || 'dashboards'.includes(searchString.toLowerCase())) {
      options.unshift({ label: 'Dashboards', value: { uid: 'general', title: 'Dashboards' } });
    }

    setLoading(false);
    return options;
  }

  // Use existing backend service search
  const params = {
    query: searchString,
    type: 'folder',
    permission: PermissionLevelString.View,
  };

  const searchHits = await getBackendSrv().search(params);
  const options = searchHits.map((d) => ({
    label: d.title,
    value: { uid: d.uid, title: d.title },
  }));

  if (!searchString || 'dashboards'.includes(searchString.toLowerCase())) {
    options.unshift({ label: 'Dashboards', value: { uid: 'general', title: 'Dashboards' } });
  }

  setLoading(false);
  return options;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      label: 'container',
      position: 'relative',
      minWidth: '180px',
      flexGrow: 1,
    }),
    clear: css({
      label: 'clear',
      fontSize: theme.spacing(1.5),
      position: 'absolute',
      top: -theme.spacing(4.5),
      right: 0,
    }),
  };
}
