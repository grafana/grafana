import React, { useEffect, useState, ChangeEvent } from 'react';

import { getBackendSrv } from '@grafana/runtime';
import { Input } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { AddNewRule } from './AddNewRule';
import { PipelineTable } from './PipelineTable';
import { Rule } from './types';

export default function PipelineAdminPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [defaultRules, setDefaultRules] = useState<any[]>([]);
  const [newRule, setNewRule] = useState<Rule>();
  const navModel = useNavModel('live-pipeline');
  const [error, setError] = useState<string>();

  const loadRules = () => {
    getBackendSrv()
      .get(`api/live/channel-rules`)
      .then((data) => {
        setRules(data.rules ?? []);
        setDefaultRules(data.rules ?? []);
      })
      .catch((e) => {
        if (e.data) {
          setError(JSON.stringify(e.data, null, 2));
        }
      });
  };

  useEffect(() => {
    loadRules();
  }, []);

  const onSearchQueryChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setRules(rules.filter((rule) => rule.pattern.toLowerCase().includes(e.target.value.toLowerCase())));
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

        <PipelineTable rules={rules} onRuleChanged={loadRules} selectRule={newRule} />

        <AddNewRule
          onRuleAdded={(r: Rule) => {
            console.log('GOT', r, 'vs', rules[0]);
            setNewRule(r);
            loadRules();
          }}
        />
      </Page.Contents>
    </Page>
  );
}
