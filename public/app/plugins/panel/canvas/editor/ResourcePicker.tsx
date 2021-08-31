import React, { useEffect, useState, ChangeEvent } from 'react';
import {
  TabContent,
  Label,
  Button,
  Select,
  Input,
  Spinner,
  TabsBar,
  Tab,
  StringValueEditor,
  useTheme2,
} from '@grafana/ui';
import { SelectableValue } from '../../../../../../packages/grafana-data/src';
import { getBackendSrv } from '@grafana/runtime';
import Cards from './Cards';
import SVG from 'react-inlinesvg';
import ImageUploader from './ImageUploader';
interface Props {
  value: string; //img/icons/unicons/0-plus.svg
  onChange: (value: string) => void;
  mediaType: 'icon' | 'image';
}

function ResourcePicker(props: Props) {
  const { value, onChange, mediaType } = props;
  const folders = (mediaType === 'icon' ? ['img/icons/unicons', 'img/icons/iot'] : ['img/bg']).map((v) => ({
    label: v,
    value: v,
  }));
  const [currentFolder, setCurrentFolder] = useState<SelectableValue<string>>();
  const [tabs, setTabs] = useState([
    { label: 'Select', active: true },
    { label: 'Upload', active: false },
  ]);
  const [directoryIndex, setDirectoryIndex] = useState<SelectableValue[]>([]);
  const [defaultList, setDefaultList] = useState<SelectableValue[]>([]);
  const [isOpenUpload, setOpenUpload] = useState(false);

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
  const imgSrc = value.indexOf(':/') > 0 ? value : 'public/' + value;
  const theme = useTheme2();
  return (
    <>
      <Label>Current Item</Label>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {mediaType === 'icon' && <SVG src={imgSrc} width="40" height="40" fill={theme.colors.text.primary} />}
        {mediaType === 'image' && <img src={imgSrc} width="40" height="40" />}
        <StringValueEditor value={value} onChange={onChange} item={{} as any} context={{} as any} />
        <Button>Apply</Button>
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
          <>
            <Select options={folders} onChange={setCurrentFolder} />
            <Input placeholder="Search" onChange={onChangeSearch} />
            {directoryIndex ? (
              <Cards cards={directoryIndex} onChange={onChange} currentFolder={currentFolder} />
            ) : (
              <Spinner />
            )}
          </>
        )}
        {tabs[1].active && <Button onClick={() => setOpenUpload(true)}>Upload</Button>}
        {isOpenUpload && <ImageUploader />}
      </TabContent>
    </>
  );
}
export default ResourcePicker;
