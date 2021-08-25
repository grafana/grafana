import React, { useState, useEffect } from 'react';
import { Modal, Button, TabContent, ModalTabsHeader } from '@grafana/ui';
import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import Cards from './Cards';
import ImageUploader from './ImageUploader';

const IconModal = (props: StandardEditorProps) => {
  const { onChange } = props;
  const [isOpen, setOpen] = useState(false);
  const [icons, setIcons] = useState<SelectableValue[]>([]);
  const [activeTab, setActiveTab] = useState('select');
  const [isOpenUpload, setIsOpenUpload] = useState(false);
  const [folder, setFolder] = useState<SelectableValue<string>>({ label: 'icons', value: 'img/icons/unicons/' });

  const iconRoot = (window as any).__grafana_public_path__ + folder.value;
  const onSelectIcon = (value: string) => {
    onChange({ fixed: value, mode: 'fixed' });
    setOpen(false);
  };
  const onSelectFolder = (value: SelectableValue<string>) => {
    setFolder(value);
  };

  useEffect(() => {
    getBackendSrv()
      .get(`${iconRoot}/index.json`)
      .then((data) => {
        setIcons(
          data.files.map((icon: string) => ({
            value: icon,
            label: icon,
            imgUrl: iconRoot + icon,
          }))
        );
      });
  }, [iconRoot]);

  const tabs = [
    { label: 'Select Image', value: 'select', active: true },
    { label: 'Upload Image', value: 'upload', active: false },
  ];
  const modalHeader = (
    <ModalTabsHeader
      title="Icon Selector"
      icon="cog"
      tabs={tabs}
      activeTab={activeTab}
      onChangeTab={(t) => {
        setActiveTab(t.value);
      }}
    />
  );

  return (
    <>
      <Button onClick={() => setOpen(true)}>Select Icon</Button>
      {isOpen && (
        <Modal isOpen={isOpen} title={modalHeader} onDismiss={() => setOpen(false)} closeOnEscape>
          <TabContent>
            {activeTab === 'select' && (
              <Cards cards={icons} onSelectIcon={onSelectIcon} onSelectFolder={onSelectFolder} {...props}></Cards>
            )}
            {activeTab === 'upload' && <Button onClick={() => setIsOpenUpload(true)}>Upload</Button>}
            {isOpenUpload && (
              <Modal isOpen={isOpenUpload} title="Upload" onDismiss={() => setIsOpenUpload(false)}>
                <ImageUploader />
              </Modal>
            )}
          </TabContent>
        </Modal>
      )}
    </>
  );
};

export default IconModal;
