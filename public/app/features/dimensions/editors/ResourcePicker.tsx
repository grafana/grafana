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
import { getBackendSrv } from '@grafana/runtime';
import { ResourceCards } from './ResourceCards';
import SVG from 'react-inlinesvg';
import { css } from '@emotion/css';
import { getPublicOrAbsoluteUrl } from '../resource';

interface Props {
  value?: string; //img/icons/unicons/0-plus.svg
  onChange: (value?: string) => void;
  mediaType: 'icon' | 'image';
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
  const [directoryIndex, setDirectoryIndex] = useState<SelectableValue[]>([]);
  const [defaultList, setDefaultList] = useState<SelectableValue[]>([]);
  const theme = useTheme2();
  const styles = getStyles(theme);

  useEffect(() => {
    // we don't want to load everything before picking a folder
    if (currentFolder) {
      getBackendSrv()
        .get(`public/${currentFolder?.value}/index.json`)
        .then((data) => {
          const cards = data.files.map((v: string) => ({
            value: v,
            label: v,
            imgUrl: `public/${currentFolder?.value}/${v}`,
          }));
          setDirectoryIndex(cards);
          setDefaultList(cards);
        })
        .catch((e) => console.error(e));
    } else {
      return;
    }
  }, [currentFolder]);

  const onChangeSearch = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const filtered = directoryIndex.filter((card) =>
        card.value
          // exclude file type (.svg) in the search
          .substr(0, card.value.length - 4)
          .toLocaleLowerCase()
          .includes(e.target.value.toLocaleLowerCase())
      );
      setDirectoryIndex(filtered);
    } else {
      setDirectoryIndex(defaultList);
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
            {directoryIndex ? (
              <div className={styles.cardsWrapper}>
                <ResourceCards cards={directoryIndex} onChange={onChange} currentFolder={currentFolder} />
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
