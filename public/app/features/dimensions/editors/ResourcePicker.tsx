import React, { useEffect, useState, ChangeEvent } from 'react';
import {
  TabContent,
  Button,
  Select,
  Input,
  Spinner,
  TabsBar,
  Tab,
  StringValueEditor,
  useTheme2,
  stylesFactory,
} from '@grafana/ui';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { ResourceCards } from './ResourceCards';
import SVG from 'react-inlinesvg';
import { css } from '@emotion/css';
import { getPublicOrAbsoluteUrl } from '../resource';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { FileElement, GrafanaDatasource } from 'app/plugins/datasource/grafana/datasource';

interface Props {
  value?: string; //img/icons/unicons/0-plus.svg
  onChange: (value?: string) => void;
  mediaType: 'icon' | 'image';
}

interface ResourceItem {
  label: string;
  value: string;
  search: string;
  imgUrl: string;
}

export function ResourcePicker(props: Props) {
  const { value, onChange, mediaType } = props;
  const folders = (mediaType === 'icon' ? ['img/icons/unicons', 'img/icons/iot'] : ['img/bg']).map((v) => ({
    label: v,
    value: v,
  }));
  const folderOfCurrentValue = value ? folders.filter((folder) => value.indexOf(folder.value) > -1)[0] : folders[0];
  const [currentFolder, setCurrentFolder] = useState<SelectableValue<string>>(folderOfCurrentValue);
  const [tabs, setTabs] = useState([
    { label: 'Select', active: true },
    // { label: 'Upload', active: false },
  ]);
  const [directoryIndex, setDirectoryIndex] = useState<ResourceItem[]>([]);
  const [filteredIndex, setFilteredIndex] = useState<ResourceItem[]>([]);
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
                    value: item.name,
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

  const onChangeSearch = (e: ChangeEvent<HTMLInputElement>) => {
    let query = e.currentTarget.value;
    if (query) {
      query = query.toLowerCase();
      setFilteredIndex(directoryIndex.filter((card) => card.search.includes(query)));
    } else {
      setFilteredIndex(directoryIndex);
    }
  };
  const imgSrc = getPublicOrAbsoluteUrl(value!);

  return (
    <div>
      <div className={styles.currentItem}>
        {value && (
          <>
            {mediaType === 'icon' && <SVG src={imgSrc} className={styles.img} />}
            {mediaType === 'image' && <img src={imgSrc} className={styles.img} />}
          </>
        )}
        <StringValueEditor value={value ?? ''} onChange={onChange} item={{} as any} context={{} as any} />
        <Button variant="secondary" onClick={() => onChange(value)}>
          Apply
        </Button>
      </div>
      <TabsBar>
        {tabs.map((tab, index) => (
          <Tab
            label={tab.label}
            key={index}
            active={tab.active}
            onChangeTab={() => setTabs(tabs.map((tab, idx) => ({ ...tab, active: idx === index })))}
          />
        ))}
      </TabsBar>
      <TabContent>
        {tabs[0].active && (
          <div className={styles.tabContent}>
            <Select options={folders} onChange={setCurrentFolder} value={currentFolder} />
            <Input placeholder="Search" onChange={onChangeSearch} />
            {filteredIndex ? (
              <div className={styles.cardsWrapper}>
                <ResourceCards cards={filteredIndex} onChange={onChange} currentFolder={currentFolder} />
              </div>
            ) : (
              <Spinner />
            )}
          </div>
        )}
        {/* TODO: add file upload
          {tabs[1].active && (
          <FileUpload
            onFileUpload={({ currentTarget }) => console.log('file', currentTarget?.files && currentTarget.files[0])}
            className={styles.tabContent}
          />
        )} */}
      </TabContent>
    </div>
  );
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    cardsWrapper: css`
      height: calc(100vh - 480px);
    `,
    tabContent: css`
      margin-top: 20px;
      & > :nth-child(2) {
        margin-top: 10px;
      },
    `,
    currentItem: css`
      display: flex;
      justify-content: space-between;
      align-items: center;
      column-gap: 2px;
      margin: -18px 0px 18px 0px;
    `,
    img: css`
      width: 40px;
      height: 40px;
      fill: ${theme.colors.text.primary};
    `,
  };
});
