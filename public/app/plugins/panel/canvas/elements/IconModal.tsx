import React, { useState } from 'react';
import { Modal, Button, TabContent, ModalTabsHeader } from '@grafana/ui';
import { StandardEditorProps } from '@grafana/data';

import Cards from './Cards';
import ImageUploader from './ImageUploader';

const IconModal = (props: StandardEditorProps) => {
  const { onChange, value, item, context } = props;
  console.log(context);
  const [isOpen, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('select');
  const [isOpenUpload, setIsOpenUpload] = useState(false);

  const imageRoot = (window as any).__grafana_public_path__ + 'img/bg/';

  const onChangeItem = (value: string) => {
    if (item.settings.resourceType === 'icon') {
      onChange({
        ...context.options.path,
        fixed: value,
        mode: 'fixed',
      });
    } else if (item.settings.resourceType === 'image') {
      onChange({
        ...context.options.background,
        fixed: imageRoot + value,
        mode: 'fixed',
      });
    }
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
              <Cards onChange={onChangeItem} value={value} folder={item.settings.resourceType}></Cards>
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
