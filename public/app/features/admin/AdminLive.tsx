import React, { useEffect, useState } from 'react';
import { getBackendSrv } from '../../../../packages/grafana-runtime/src';
import { Table, useTheme2, Modal, TabContent, TabsBar, Tab, CodeEditor, PageToolbar } from '@grafana/ui';
import { DataFrame, FieldType, GrafanaTheme2, MutableDataFrame, applyFieldOverrides } from '@grafana/data';

interface Row {
  id?: string;
  cells?: any[];
  depth: number;
  values?: string[];
}

export default function AdminLive() {
  const buildData = (theme: GrafanaTheme2, rules: any): DataFrame => {
    const data = new MutableDataFrame({
      fields: [
        { name: 'Pattern', type: FieldType.string, values: [] },
        {
          name: 'Convertor',
          type: FieldType.string,
          values: [],
        },
        { name: 'Processor', type: FieldType.string, values: [] },
        { name: 'Output', type: FieldType.string, values: [] },
      ],
    });
    for (let i = 0; i < rules.length; i++) {
      data.appendRow([
        rules[i].pattern,
        rules[i].settings?.converter?.type,
        rules[i].settings?.processor?.type,
        rules[i].settings?.output?.type,
      ]);
    }

    return applyFieldOverrides({
      data: [data],
      fieldConfig: {
        overrides: [],
        defaults: {},
      },
      theme,
      replaceVariables: (value: string) => value,
    })[0];
  };
  const theme = useTheme2();
  const [rules, setRules] = useState<any[]>([]);
  const [data, setData] = useState(() => buildData(theme, rules));
  const [isOpen, setOpen] = useState(false);
  const [rowClicked, setRowClicked] = useState<Row>();
  const [activeTab, setActiveTab] = useState('convertor');
  const [host, setHost] = useState<string>();
  const selectedRule = rules.filter((rule) => rule.pattern === rowClicked?.values?.[0])[0];

  useEffect(() => {
    getBackendSrv()
      .get(`api/live/channel-rules`)
      .then((data) => {
        setRules(data.rules);
        setData(() => buildData(theme, data.rules));
      })
      .catch((e) => console.error(e));
  }, []);

  useEffect(() => {
    getBackendSrv()
      .get(`api/live/remote-write-backends`)
      .then((data) => {
        setHost(data.remoteWriteBackends[0].uid);
      })
      .catch((e) => console.error(e));
  }, []);

  const onRowClick = (row: Row) => {
    setOpen(true);
    setRowClicked(row);
  };

  const onCellClick = (cell: any) => {
    setActiveTab(cell.column.Header.toLowerCase());
  };

  const tabs = [
    { label: 'pattern', value: 'pattern' },
    { label: 'convertor', value: 'convertor' },
    { label: 'processor', value: 'processor' },
    { label: 'output', value: 'output' },
  ];
  const width = 500;
  const height = 500;
  const title = rowClicked?.values?.[0] || 'Rules';
  return (
    <>
      <h2 style={{ margin: '10px 0 10px 10px' }}>{`Admin Live Config / ${host}`}</h2>
      <Table data={data} width={width} height={height} onRowClick={onRowClick} onCellClick={onCellClick} />
      {isOpen && (
        <Modal isOpen={isOpen} title={title} onDismiss={() => setOpen(false)} closeOnEscape>
          <TabsBar>
            {tabs.map((tab, index) => {
              return (
                <Tab
                  key={index}
                  label={tab.label}
                  active={tab.value === activeTab}
                  onChangeTab={() => setActiveTab(tab.value)}
                />
              );
            })}
          </TabsBar>
          <TabContent>
            {activeTab === 'pattern' && <div>{title}</div>}
            {activeTab === 'convertor' && (
              <CodeEditor
                height={height}
                value={JSON.stringify(selectedRule?.settings?.converter, null, '\t')}
                showLineNumbers={true}
                readOnly={true}
                language="json"
                showMiniMap={false}
              />
            )}
            {activeTab === 'processor' && (
              <CodeEditor
                height={height}
                value={JSON.stringify(selectedRule?.settings?.processor, null, '\t')}
                showLineNumbers={true}
                readOnly={true}
                language="json"
                showMiniMap={false}
              />
            )}
            {activeTab === 'output' && (
              <CodeEditor
                height={height}
                value={JSON.stringify(selectedRule?.settings?.output, null, '\t')}
                showLineNumbers={true}
                readOnly={true}
                language="json"
                showMiniMap={false}
              />
            )}
          </TabContent>
        </Modal>
      )}
    </>
  );
}
