import React, { useState, useEffect } from 'react';
import { Modal, Button, TabContent, ModalTabsHeader } from '@grafana/ui';
import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import Cards from './Cards';
import ImageUploader from './ImageUploader';

const IconModal = (props: StandardEditorProps) => {
  const paths = {
    icon: 'img/icons/unicons/',
    mono: 'img/icons/mono',
    custom: 'img/icons/custom',
  };
  const { onChange, context } = props;
  const [isOpen, setOpen] = useState(false);
  const [icons, setIcons] = useState<SelectableValue[]>([]);
  const [activeTab, setActiveTab] = useState('select');
  const [isOpenUpload, setIsOpenUpload] = useState(false);
  const getKeyValue = <T extends object, U extends keyof T>(obj: T) => (key: U) => obj[key];
  const resourceType = getKeyValue(paths)(context.options.type);

  const iconRoot = (window as any).__grafana_public_path__ + resourceType;
  const handleSelectIcon = (value: string) => {
    onChange({ fixed: value, mode: 'fixed' });
    setOpen(false);
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
    { label: 'Icon Select', value: 'select', active: true },
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
            {activeTab === 'select' && <Cards cards={icons} onSelectIcon={handleSelectIcon} {...props}></Cards>}
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
