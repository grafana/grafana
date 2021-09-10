import React, { useEffect, useState, ChangeEvent } from 'react';
import { getBackendSrv } from '../../../../packages/grafana-runtime/src';
import { Modal, TabContent, TabsBar, Tab, CodeEditor, Input, useStyles } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';

export default function AdminLive() {
  const [rules, setRules] = useState<any[]>([]);
  const [isOpen, setOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<any>();
  const [currentPattern, setCurrentPattern] = useState<string>();
  const [activeTab, setActiveTab] = useState<string>('converter');
  // TODO: do we want to show the uid somewhere?
  const [uid, setUid] = useState<string>();
  const [defaultRules, setDefaultRules] = useState<any[]>([]);
  const navModel = useNavModel('live');
  const styles = useStyles(getStyles);

  useEffect(() => {
    getBackendSrv()
      .get(`api/live/channel-rules`)
      .then((data) => {
        setRules(data.rules);
        setDefaultRules(data.rules);
      })
      .catch((e) => console.error(e));
  }, []);

  useEffect(() => {
    getBackendSrv()
      .get(`api/live/remote-write-backends`)
      .then((data) => {
        setUid(data.remoteWriteBackends[0].uid);
      })
      .catch((e) => console.error(e));
  }, []);

  const onRowClick = (event: any) => {
    const pattern = event.target.getAttribute('data-pattern');
    setCurrentPattern(pattern);
    const column = event.target.getAttribute('data-column');
    setActiveTab(column);
    setSelectedRule(rules.filter((rule) => rule.pattern === pattern)[0]);
    setOpen(true);
  };
  const onSearchQueryChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setRules(rules.filter((rule) => rule.pattern.toLowerCase().includes(e.target.value.toLowerCase())));
      console.log(e.target.value, rules);
    } else {
      setRules(defaultRules);
    }
  };

  const tabs = [
    { label: 'pattern', value: 'pattern' },
    { label: 'converter', value: 'converter' },
    { label: 'processor', value: 'processor' },
    { label: 'output', value: 'output' },
  ];
  const height = 500;
  const title = currentPattern || 'Rules';

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <div className="page-action-bar">
          <div className="gf-form gf-form--grow">
            <Input placeholder="Search pattern..." onChange={onSearchQueryChange} />
          </div>
        </div>
        <div className="admin-list-table">
          <table className="filter-table filter-table--hover form-inline">
            <thead>
              <tr>
                <th>Pattern</th>
                <th>Converter</th>
                <th>Processor</th>
                <th>Output</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.pattern} onClick={onRowClick} className={styles.row}>
                  <td data-pattern={rule.pattern} data-column="pattern">
                    {rule.pattern}
                  </td>
                  <td data-pattern={rule.pattern} data-column="converter">
                    {rule.settings?.converter?.type}
                  </td>
                  <td data-pattern={rule.pattern} data-column="processor">
                    {rule.settings?.processor?.type}
                  </td>
                  <td data-pattern={rule.pattern} data-column="output">
                    {rule.settings?.output?.type}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isOpen && (
          <Modal isOpen={isOpen} title={title} onDismiss={() => setOpen(false)} closeOnEscape>
            <TabsBar>
              {tabs.map((tab, index) => {
                return (
                  <Tab
                    key={index}
                    label={tab.label}
                    active={tab.value === activeTab}
                    onChangeTab={() => {
                      setActiveTab(tab.value);
                    }}
                  />
                );
              })}
            </TabsBar>
            <TabContent>
              {activeTab === 'pattern' && <div>{title}</div>}
              {activeTab === 'converter' && (
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
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme) => {
  return {
    row: css`
      cursor: pointer;
    `,
  };
};
