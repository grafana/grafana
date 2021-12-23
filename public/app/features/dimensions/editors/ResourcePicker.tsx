import React, { useEffect, useState } from 'react';
import { css } from '@emotion/css';
import SVG from 'react-inlinesvg';
import { Button, Select, FilterInput, useTheme2, stylesFactory, Field, Modal, Label, Input } from '@grafana/ui';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';

import { ResourceCards } from './ResourceCards';
import { getPublicOrAbsoluteUrl } from '../resource';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { FileElement, GrafanaDatasource } from 'app/plugins/datasource/grafana/datasource';
import { ResourceFolderName } from '..';

interface Props {
  value?: string; //img/icons/unicons/0-plus.svg
  onChange: (value?: string) => void;
  mediaType: 'icon' | 'image';
  folderName: ResourceFolderName;
  setOpen: (value: boolean) => void;
}

export interface ResourceItem {
  label: string;
  value: string; // includes folder
  search: string;
  imgUrl: string;
}

const sourceOptions = [
  { label: `Folder`, value: 'folder' },
  { label: 'URL', value: 'url' },
  // { label: 'Upload', value: 'upload' }, TODO
];

const getFolders = (mediaType: 'icon' | 'image') => {
  if (mediaType === 'icon') {
    return [ResourceFolderName.Icon, ResourceFolderName.IOT, ResourceFolderName.Marker];
  } else {
    return [ResourceFolderName.BG];
  }
};

const getFolderIfExists = (folders: Array<SelectableValue<string>>, path: string) => {
  return folders.find((folder) => path.startsWith(folder.value!)) ?? folders[0];
};

export const ResourcePicker = (props: Props) => {
  const { value, onChange, mediaType, folderName, setOpen } = props;
  const folders = getFolders(mediaType).map((v) => ({
    label: v,
    value: v,
  }));

  const [currentFolder, setCurrentFolder] = useState<SelectableValue<string>>(
    getFolderIfExists(folders, value?.length ? value : folderName)
  );
  const [directoryIndex, setDirectoryIndex] = useState<ResourceItem[]>([]);
  const [filteredIndex, setFilteredIndex] = useState<ResourceItem[]>([]);
  // select between existing icon folder, url, or upload
  const [source, setSource] = useState<SelectableValue<string>>(sourceOptions[0]);
  // pass on new value to confirm button and to show in preview
  const [newValue, setNewValue] = useState<string>(value ?? '');
  const [searchQuery, setSearchQuery] = useState<string>();
  const theme = useTheme2();
  const styles = getStyles(theme);

  useEffect(() => {
    // we don't want to load everything before picking a folder
    const folder = currentFolder?.value;
    if (folder) {
      const filter =
        mediaType === 'icon'
          ? (item: FileElement) => item.name.endsWith('.svg')
          : (item: FileElement) => item.name.endsWith('.png') || item.name.endsWith('.gif');

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
                    search: (idx ? item.name.substr(0, idx) : item.name).toLowerCase(),
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
  }, [mediaType, currentFolder]);

  const onChangeSearch = (query: string) => {
    if (query) {
      query = query.toLowerCase();
      setFilteredIndex(directoryIndex.filter((card) => card.search.includes(query)));
    } else {
      setFilteredIndex(directoryIndex);
    }
  };

  const imgSrc = getPublicOrAbsoluteUrl(newValue!);

  let shortName = newValue?.substring(newValue.lastIndexOf('/') + 1, newValue.lastIndexOf('.'));
  if (shortName.length > 20) {
    shortName = shortName.substring(0, 20) + '...';
  }

  return (
    <div>
      <div className={styles.upper}>
        <div className={styles.child}>
          <Field label="Source">
            <Select menuShouldPortal={true} options={sourceOptions} onChange={setSource} value={source} />
          </Field>
          {source?.value === 'folder' && (
            <>
              <Field label="Folder">
                <Select menuShouldPortal={true} options={folders} onChange={setCurrentFolder} value={currentFolder} />
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
            </>
          )}
          {source?.value === 'url' && (
            <Field label="URL">
              <Input onChange={(e) => setNewValue(e.currentTarget.value)} value={newValue} />
            </Field>
          )}
        </div>
        <div className={styles.iconContainer}>
          <Field label="Preview">
            <div className={styles.iconPreview}>
              {mediaType === 'icon' && <SVG src={imgSrc} className={styles.img} />}
              {mediaType === 'image' && newValue && <img src={imgSrc} className={styles.img} />}
            </div>
          </Field>
          <Label>{shortName}</Label>
        </div>
      </div>
      {source?.value === 'folder' && filteredIndex && (
        <div className={styles.cardsWrapper}>
          <ResourceCards cards={filteredIndex} onChange={(v) => setNewValue(v)} value={newValue} />
        </div>
      )}

      <Modal.ButtonRow>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button variant={newValue && newValue !== value ? 'primary' : 'secondary'} onClick={() => onChange(newValue)}>
          Select
        </Button>
      </Modal.ButtonRow>
      {/* TODO: add file upload
          {tabs[1].active && (
          <FileUpload
            onFileUpload={({ currentTarget }) => console.log('file', currentTarget?.files && currentTarget.files[0])}
            className={styles.tabContent}
          />
        )} */}
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    cardsWrapper: css`
      height: 30vh;
      min-height: 50px;
      margin-top: 5px;
      max-width: 680px;
    `,
    tabContent: css`
      margin-top: 20px;
      & > :nth-child(2) {
        margin-top: 10px;
      },
    `,
    iconPreview: css`
      width: 95px;
      height: 79px;
      border: 1px solid ${theme.colors.border.medium};
      display: flex;
      align-items: center;
      justify-content: center;
    `,
    iconContainer: css`
      display: flex;
      flex-direction: column;
      width: 40%;
      align-items: center;
    `,
    img: css`
      width: 49px;
      height: 49px;
      fill: ${theme.colors.text.primary};
    `,
    child: css`
      width: 60%;
    `,
    upper: css`
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
    `,
  };
});
