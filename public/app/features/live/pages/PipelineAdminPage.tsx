import React, { useEffect, useState, ChangeEvent } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { Input, Tag, useStyles } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { Rule, Output } from './types';
import { RuleModal } from './RuleModal';

function renderOutputTags(key: string, output?: Output): React.ReactNode {
  if (!output?.type) {
    return null;
  }
  if (output.multiple?.outputs?.length) {
    return output.multiple?.outputs.map((v, i) => renderOutputTags(`${key}-${i}`, v));
  }
  return <Tag key={key} name={output.type} />;
}

export default function PipelineAdminPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [isOpen, setOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<Rule>();
  const [defaultRules, setDefaultRules] = useState<any[]>([]);
  const navModel = useNavModel('live-pipeline');
  const [error, setError] = useState<string>();
  const styles = useStyles(getStyles);

  useEffect(() => {
    getBackendSrv()
      .get(`api/live/channel-rules`)
      .then((data) => {
        setRules(data.rules);
        setDefaultRules(data.rules);
      })
      .catch((e) => {
        if (e.data) {
          setError(JSON.stringify(e.data, null, 2));
        }
      });
  }, []);

  const onRowClick = (event: any) => {
    const pattern = event.target.getAttribute('data-pattern');
    const column = event.target.getAttribute('data-column');
    console.log('show:', column);
    // setActiveTab(column);
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

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        {error && <pre>{error}</pre>}
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
                    {renderOutputTags('out', rule.settings?.output)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isOpen && selectedRule && <RuleModal rule={selectedRule} isOpen={isOpen} onClose={() => setOpen(false)} />}
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
