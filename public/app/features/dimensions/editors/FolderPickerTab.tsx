import { css } from '@emotion/css';
import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Field, FilterInput, Combobox, useStyles2, type ComboboxOption } from '@grafana/ui';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { type FileElement, type GrafanaDatasource } from 'app/plugins/datasource/grafana/datasource';

import { MediaType, ResourceFolderName } from '../types';

import { ResourceCards } from './ResourceCards';

const getFolders = (mediaType: MediaType) => {
  if (mediaType === MediaType.Icon) {
    return [ResourceFolderName.Icon, ResourceFolderName.IOT, ResourceFolderName.Marker];
  } else {
    return [ResourceFolderName.BG];
  }
};

const getFolderIfExists = (folders: Array<ComboboxOption<string>>, path: string) => {
  return folders.find((folder) => path.startsWith(folder.value!)) ?? folders[0];
};

export interface ResourceItem {
  label: string;
  value: string; // includes folder
  search: string;
  imgUrl: string;
}

interface Props {
  value?: string;
  mediaType: MediaType;
  folderName: ResourceFolderName;
  newValue: string;
  setNewValue: Dispatch<SetStateAction<string>>;
  maxFiles?: number;
}

export const FolderPickerTab = (props: Props) => {
  const { value, mediaType, folderName, newValue, setNewValue, maxFiles } = props;
  const styles = useStyles2(getStyles);

  const folders = getFolders(mediaType).map((v) => ({
    label: v,
    value: v,
  }));

  const [searchQuery, setSearchQuery] = useState<string>();

  const [currentFolder, setCurrentFolder] = useState<ComboboxOption<string>>(
    getFolderIfExists(folders, value?.length ? value : folderName)
  );
  const [directoryIndex, setDirectoryIndex] = useState<ResourceItem[]>([]);
  const [filteredIndex, setFilteredIndex] = useState<ResourceItem[]>([]);

  const onChangeSearch = (query: string) => {
    if (query) {
      query = query.toLowerCase();
      setFilteredIndex(directoryIndex.filter((card) => card.search.includes(query)));
    } else {
      setFilteredIndex(directoryIndex);
    }
  };

  useEffect(() => {
    // we don't want to load everything before picking a folder
    const folder = currentFolder?.value;
    if (folder) {
      const filter =
        mediaType === MediaType.Icon
          ? (item: FileElement) => item.name.endsWith('.svg')
          : (item: FileElement) => item.name.endsWith('.png') || item.name.endsWith('.gif');

      getDatasourceSrv()
        .get('-- Grafana --')
        .then((ds) => {
          (ds as GrafanaDatasource).listFiles(folder, maxFiles).subscribe({
            next: (frame) => {
              const cards: ResourceItem[] = [];
              frame.forEach((item) => {
                if (filter(item)) {
                  const idx = item.name.lastIndexOf('.');
                  cards.push({
                    value: `${folder}/${item.name}`,
                    label: item.name,
                    search: (idx ? item.name.substring(0, idx) : item.name).toLowerCase(),
                    imgUrl: `${window.__grafana_public_path__}build/${folder}/${item.name}`,
                  });
                }
              });
              setDirectoryIndex(cards);
              setFilteredIndex(cards);
            },
          });
        });
    }
  }, [mediaType, currentFolder, maxFiles]);

  return (
    <>
      <Field>
        <Combobox
          options={folders}
          onChange={setCurrentFolder}
          value={currentFolder}
          aria-label={t('dimensions.folder-picker-tab.label-folder', 'Folder')}
        />
      </Field>
      <Field>
        <FilterInput
          value={searchQuery ?? ''}
          placeholder={t('dimensions.folder-picker-tab.placeholder-search', 'Search')}
          escapeRegex={false}
          onChange={(v) => {
            onChangeSearch(v);
            setSearchQuery(v);
          }}
        />
      </Field>
      {filteredIndex && (
        <div className={styles.cardsWrapper}>
          <ResourceCards cards={filteredIndex} onChange={(v) => setNewValue(v)} value={newValue} />
        </div>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  cardsWrapper: css({
    height: '30vh',
    minHeight: '50px',
    marginTop: '5px',
    maxWidth: '680px',
  }),
});
