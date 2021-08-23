import React, { useState, useEffect } from 'react';
import { Modal, Button, TabContent, ModalTabsHeader } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import Cards from './Cards';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

const IconModal: React.FC<Props> = ({ onChange }) => {
  const [isOpen, setOpen] = useState(false);
  const [icons, setIcons] = useState<SelectableValue[]>([]);
  const [activeTab, setActiveTab] = useState('select');

  const iconRoot = (window as any).__grafana_public_path__ + 'img/icons/unicons/';
  const handleSelectIcon = (value: string) => {
    onChange(value);
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
        <Modal isOpen={true} title={modalHeader} onDismiss={() => setOpen(false)} closeOnEscape>
          <TabContent>
            {activeTab === 'select' && <Cards cards={icons} onSelectIcon={handleSelectIcon}></Cards>}
            {activeTab === 'upload' && <Button>Upload</Button>}
          </TabContent>
        </Modal>
      )}
    </>
  );
};

export default IconModal;
