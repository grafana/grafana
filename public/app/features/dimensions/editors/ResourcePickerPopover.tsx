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
import { FocusScope } from '@react-aria/focus';

interface Props {
  value?: string; //img/icons/unicons/0-plus.svg
  onChange: (value?: string) => void;
  mediaType: 'icon' | 'image';
  folderName: ResourceFolderName;
}

export interface ResourceItem {
  label: string;
  value: string; // includes folder
  search: string;
  imgUrl: string;
}

type PickerType = 'folder' | 'url';

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

export const ResourcePickerPopover = (props: Props) => {
  const { value, onChange, mediaType, folderName } = props;
  const folders = getFolders(mediaType).map((v) => ({
    label: v,
    value: v,
  }));

  const [currentFolder, setCurrentFolder] = useState<SelectableValue<string>>(
    getFolderIfExists(folders, value?.length ? value : folderName)
  );
  const [directoryIndex, setDirectoryIndex] = useState<ResourceItem[]>([]);
  const [filteredIndex, setFilteredIndex] = useState<ResourceItem[]>([]);
  // pass on new value to confirm button and to show in preview
  const [newValue, setNewValue] = useState<string>(value ?? '');
  const [searchQuery, setSearchQuery] = useState<string>();
  const theme = useTheme2();
  const styles = getStyles(theme);

  const [activePicker, setActivePicker] = useState<PickerType>('folder');

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

  const getTabClassName = (tabName: PickerType) => {
    return `ResourcePickerPopover__tab ${activePicker === tabName && 'ResourcePickerPopover__tab--active'}`;
  };

  const renderFolderPicker = () => (
    <>
      <Field>
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
      {filteredIndex && (
        <div className={styles.cardsWrapper}>
          <ResourceCards cards={filteredIndex} onChange={(v) => setNewValue(v)} value={newValue} />
        </div>
      )}
    </>
  );

  const renderURLPicker = () => (
    <>
      <Field>
        <Input onChange={(e) => setNewValue(e.currentTarget.value)} value={newValue} />
      </Field>
      <div className={styles.iconContainer}>
        <Field label="Preview">
          <div className={styles.iconPreview}>
            {mediaType === 'icon' && <SVG src={imgSrc} className={styles.img} />}
            {mediaType === 'image' && newValue && <img src={imgSrc} className={styles.img} />}
          </div>
        </Field>
        <Label>{shortName}</Label>
      </div>
    </>
  );

  const renderPicker = () => {
    switch (activePicker) {
      case 'folder':
        return renderFolderPicker();
      case 'url':
        return renderURLPicker();
      default:
        return renderFolderPicker();
    }
  };

  return (
    <FocusScope>
      <div className={styles.resourcePickerPopover}>
        <div className={styles.resourcePickerPopoverTabs}>
          <button className={getTabClassName('folder')} onClick={() => setActivePicker('folder')}>
            Folder
          </button>
          <button className={getTabClassName('url')} onClick={() => setActivePicker('url')}>
            URL
          </button>
        </div>
        <div className={styles.resourcePickerPopoverContent}>
          {renderPicker()}
          <Button
            className={styles.selectButton}
            variant={newValue && newValue !== value ? 'primary' : 'secondary'}
            onClick={() => onChange(newValue)}
          >
            Select
          </Button>
        </div>
      </div>
    </FocusScope>
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
    iconPreview: css`
      width: 238px;
      height: 198px;
      border: 1px solid ${theme.colors.border.medium};
      display: flex;
      align-items: center;
      justify-content: center;
    `,
    iconContainer: css`
      display: flex;
      flex-direction: column;
      width: 80%;
      align-items: center;
      align-self: center;
    `,
    img: css`
      width: 147px;
      height: 147px;
      fill: ${theme.colors.text.primary};
    `,
    resourcePickerPopover: css`
      border-radius: ${theme.shape.borderRadius()};
      box-shadow: ${theme.shadows.z3};
      background: ${theme.colors.background.primary};
      border: 1px solid ${theme.colors.border.medium};

      .ResourcePickerPopover__tab {
        width: 50%;
        text-align: center;
        padding: ${theme.spacing(1, 0)};
        background: ${theme.colors.background.secondary};
        color: ${theme.colors.text.secondary};
        font-size: ${theme.typography.bodySmall.fontSize};
        cursor: pointer;
        border: none;

        &:focus:not(:focus-visible) {
          outline: none;
          box-shadow: none;
        }

        :focus-visible {
          position: relative;
        }
      }

      .ResourcePickerPopover__tab--active {
        color: ${theme.colors.text.primary};
        font-weight: ${theme.typography.fontWeightMedium};
        background: ${theme.colors.background.primary};
      }
    `,
    resourcePickerPopoverContent: css`
      width: 300px;
      font-size: ${theme.typography.bodySmall.fontSize};
      min-height: 184px;
      padding: ${theme.spacing(1)};
      display: flex;
      flex-direction: column;
    `,
    resourcePickerPopoverTabs: css`
      display: flex;
      width: 100%;
      border-radius: ${theme.shape.borderRadius()} ${theme.shape.borderRadius()} 0 0;
    `,
    selectButton: css`
      align-self: center;
      align-text: center;
      margin-top: 20px;
      margin-bottom: 10px;
    `,
  };
});
