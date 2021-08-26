import React, { useState } from 'react';
import { Modal, Button, TabContent, ModalTabsHeader } from '@grafana/ui';
import { StandardEditorProps } from '@grafana/data';

import Cards from './Cards';
import ImageUploader from './ImageUploader';

const IconModal = (props: StandardEditorProps) => {
  const { onChange, value, item } = props;
  const [isOpen, setOpen] = useState(false);

  const [activeTab, setActiveTab] = useState('select');
  const [isOpenUpload, setIsOpenUpload] = useState(false);

  const onSelectIcon = (value: string) => {
    onChange({ fixed: value, mode: 'fixed' });
    setOpen(false);
  };

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
      <Button onClick={() => setOpen(true)}>Select Item</Button>
      {isOpen && (
        <Modal isOpen={isOpen} title={modalHeader} onDismiss={() => setOpen(false)} closeOnEscape>
          <TabContent>
            {activeTab === 'select' && (
              <Cards onSelectIcon={onSelectIcon} value={value} folder={item.settings.resourceType}></Cards>
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
