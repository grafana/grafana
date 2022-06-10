import { css } from '@emotion/css';
import React, { Dispatch, SetStateAction, useEffect, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Field, FilterInput, Select, useStyles2 } from '@grafana/ui';
import { config } from 'app/core/config';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { FileElement, GrafanaDatasource } from 'app/plugins/datasource/grafana/datasource';

import { MediaType, ResourceFolderName } from '../types';

import { ResourceCards } from './ResourceCards';

const getFolders = (mediaType: MediaType) => {
  if (mediaType === MediaType.Icon) {
    return [ResourceFolderName.Icon, ResourceFolderName.IOT, ResourceFolderName.Marker];
  } else {
    // TODO: hardcode upload for now but need to figure out how to get folder name
    return [ResourceFolderName.BG, 'upload'];
  }
};

const getFolderIfExists = (folders: Array<SelectableValue<string>>, path: string) => {
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
}

export const FolderPickerTab = (props: Props) => {
  const { value, mediaType, folderName, newValue, setNewValue } = props;
  const styles = useStyles2(getStyles);

  const folders = getFolders(mediaType).map((v) => ({
    label: v,
    value: v,
  }));

  const [searchQuery, setSearchQuery] = useState<string>();

  const [currentFolder, setCurrentFolder] = useState<SelectableValue<string>>(
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
      // TODO: not branching these API calls?
      if (folder.toLowerCase().includes('upload')) {
        fetch(`/api/storage/list/upload`)
          .then((res) => res.json())
          .then(({ data }) => {
            const filesArray = data.values[0];
            const cards: ResourceItem[] = [];
            filesArray.forEach((fileName: string) => {
              const idx = fileName.lastIndexOf('.');
              cards.push({
                value: `${config.appUrl}api/storage/read/upload/${fileName}`,
                label: fileName,
                search: (idx ? fileName.substring(0, idx) : fileName).toLowerCase(),
                imgUrl: `${config.appUrl}api/storage/read/upload/${fileName}`,
              });
            });
            setDirectoryIndex(cards);
            setFilteredIndex(cards);
          });
      } else {
        getDatasourceSrv()
          .get('-- Grafana --')
          .then((ds) => {
            (ds as GrafanaDatasource).listFiles(folder).subscribe({
              next: (frame) => {
                const cards: ResourceItem[] = [];
                frame.forEach((item) => {
                  if (filter(item)) {
                    const idx = item.name.lastIndexOf('.');
                    cards.push({
                      value: `${folder}/${item.name}`,
                      label: item.name,
                      search: (idx ? item.name.substring(0, idx) : item.name).toLowerCase(),
                      imgUrl: `public/${folder}/${item.name}`,
                    });
                  }
                });
                setDirectoryIndex(cards);
                setFilteredIndex(cards);
              },
            });
          });
      }
    }
  }, [mediaType, currentFolder]);

  return (
    <>
      <Field>
        <Select options={folders} onChange={setCurrentFolder} value={currentFolder} menuShouldPortal={false} />
      </Field>
      <Field>
        <FilterInput
          value={searchQuery ?? ''}
          placeholder="Search"
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
  cardsWrapper: css`
    height: 30vh;
    min-height: 50px;
    margin-top: 5px;
    max-width: 680px;
  `,
});
